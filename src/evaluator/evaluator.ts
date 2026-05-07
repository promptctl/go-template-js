/**
 * Engine<T> — generic-over-T template evaluator.
 *
 * [LAW:dataflow-not-control-flow] Evaluation is one switch on the AST
 * node's type. Every node kind has exactly one production rule; the
 * shape of work is fixed by the data, not by scattered branching.
 *
 * [LAW:single-enforcer] All `string → T` conversion goes through
 * `fromString`. There is exactly one place text becomes T. Function
 * returns of `string` are routed through the same converter on their
 * way to the output stream — the asymmetry between "string in / T out"
 * is encoded as a single function call, not duplicated at every site.
 *
 * State is threaded as a single `EvalContext` per `evaluate()` call —
 * no instance mutation, so the same Engine handles concurrent evaluate
 * calls (tested through the parse-once-eval-many invariant).
 */

import {
  type ActionNode,
  assertNever,
  type CommandNode,
  type ListNode,
  type Node,
  type PipeNode,
} from "../parser/ast.js";
import { type ParseResult, parse as parseSource } from "../parser/parser.js";
import type { Pos } from "../parser/pos.js";
import { MISSING, walkFieldChain } from "./access.js";
import { defaultBuiltins } from "./builtins.js";
import { EvalError, FuncNotFoundError, MissingFieldError, TypeMismatchError } from "./errors.js";
import { isLazy } from "./lazy.js";
import { declareVar, lookupVar, pushScope, rootScope, type Scope } from "./scope.js";
import { isTruthy } from "./truthy.js";

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Declared parameter type for a registered template function. Used by
 * the no-silent-flatten guard to detect unsafe T-into-string flows.
 *
 * - "string" — must be a JS string. Non-string values raise
 *   TypeMismatchError. This is the **architectural commitment**: T
 *   never silently flattens into a string parameter.
 * - "number" — must be `typeof "number"` or `bigint`.
 * - "bool"   — must be `typeof "boolean"`.
 * - "T"      — opaque caller-defined T; treated as "anything that is
 *   not a string". The guard does no further checking.
 * - "any"    — accepts anything (the explicit permissive escape).
 *   TODO(template-laws-3gt.9): remove from the union once every
 *   registration has migrated to a precise or intent-named kind.
 * - "ordered" — orderable primitive (string, number, bigint, boolean).
 *   When two or more "ordered" slots appear in the same call, all of
 *   them must share a kind, with `number` and `bigint` bridged. Used
 *   by `lt`/`le`/`gt`/`ge` to match Go's `text/template` rule that
 *   ordering operands have the same type.
 *
 * Precise kinds (added template-laws-3gt.1, consumed in .2–.7):
 * - "list"   — array. Excludes string (Go-parity: string is not a list).
 * - "dict"   — plain object (not Map; Maps are handled separately).
 * - "sized"  — has a meaningful `len`: string | array | Map | Set | object.
 * - "comparable" — accepted by `eq`/`ne`: any JSON-shaped value
 *   (ordered primitive, nil, array, plain object, Map, or Set).
 *   Functions and symbols are excluded. When two or more "comparable"
 *   slots appear in the same call, all of them must share a kind, with
 *   `number`↔`bigint` bridged and `nil` acting as a wildcard. Object
 *   equality routes through `deepEqual` in `eq`/`ne` bodies.
 * - "stringifiable" — string directly OR a value the engine's
 *   `toString` can flatten. The matcher *probes* the conversion;
 *   downstream func bodies call `engine.toString` to actually flatten.
 * - "callable" — `typeof v === "function"`.
 * - "collection" — string | array | Map | plain object. The receiver
 *   shape `index` accepts. Sets and primitives are rejected. Nil is
 *   rejected by the gate; the body trusts a non-nil collection.
 *   (Added template-laws-3gt.7 alongside the index migration.)
 * - "index-key" — string | number | bigint. The key shape `index`
 *   accepts. The body decides which collection kind a given key fits
 *   (arrays want integer; objects want string).
 *
 * Intent-named kinds (added template-laws-3gt.1, consumed in .8) —
 * the labels carry intent for readers; runtime behavior is documented
 * pass-through except where noted:
 * - "truthy"     — anything (truthiness context).
 * - "reflective" — anything (type-inspection context).
 * - "value"      — anything (genuinely heterogeneous: constructors,
 *   structural ops). Documents intent.
 * - "serializable" — anything JSON-encodable. Runtime-validated:
 *   functions, symbols, and circular refs fail the gate.
 */
export type ArgType =
  | "string"
  | "number"
  | "bool"
  | "T"
  | "any"
  | "ordered"
  | "list"
  | "dict"
  | "sized"
  | "comparable"
  | "stringifiable"
  | "callable"
  | "collection"
  | "index-key"
  | "truthy"
  | "reflective"
  | "value"
  | "serializable";

export interface TemplateFunc {
  /**
   * The function body. Parameter types are *contravariant-bottom*
   * (`never[]`) so any concrete signature is assignable here — write
   * `fn: (s: string, n: number) => …` if that's what the func wants,
   * and rely on `argTypes` + `enforceArgTypes` to validate at runtime.
   *
   * [LAW:single-enforcer] Param-type validation lives at the dispatch
   * site (`enforceArgTypes`). The compile-time signature does not
   * duplicate that gate — it stays out of the way so consumer
   * implementations can declare the precise types they expect.
   */
  readonly fn: (...args: never[]) => unknown;
  /**
   * Declared positional parameter types. Required.
   *
   * For variadic funcs, declare the type of the trailing parameter
   * once — the no-silent-flatten guard validates every excess argument
   * against `argTypes[argTypes.length - 1]`. This matches Go's
   * `text/template` validation against repeated parameter types when
   * `Variadic`.
   *
   * The pipe-fed last argument is appended to the positional list
   * before validation, so it is checked against the trailing slot.
   */
  readonly argTypes: readonly ArgType[];
  readonly returnType?: ArgType;
  /**
   * Variadic-position lookup pattern.
   *
   * Default (omitted): the trailing slot repeats. `["string", "any"]`
   * means "first arg string, every arg after is any".
   *
   * `"alternating"`: `argTypes` describes a *cycle*. The slot for arg
   * index `i` is `argTypes[i % argTypes.length]`. Used by `dict`'s
   * `string, value, string, value, …` kv pairing — without this the
   * gate cannot distinguish even-index keys (must be string) from
   * odd-index values (anything), and the body would re-validate per
   * key, splitting `[LAW:single-enforcer]` across two layers.
   *
   * Added by template-laws-3gt.3.
   */
  readonly argTypePattern?: "alternating";
}

export type FuncMap = Record<string, TemplateFunc>;

export interface EngineConfig<T> {
  /** Convert a text literal (or string-returning function result) into T. */
  readonly fromString: (s: string) => T;
  /**
   * Flatten a T (or other engine-managed value) into a string.
   *
   * [LAW:single-enforcer] Dual of `fromString`: one place owns the
   * string→T direction, this owns the T→string direction. Built-ins
   * registered against the `"stringifiable"` ArgType call this when
   * they need to format a non-string value (the matcher probes via
   * `toString` to validate; the body re-uses it to flatten).
   *
   * Default behaviour: passes through any value that is already a
   * `typeof "string"` and throws `TypeMismatchError` for everything
   * else. That makes the `T = string` case (consumer set
   * `fromString: (s) => s`) work out of the box, while a non-string T
   * configured without a `toString` errors loudly the first time a
   * `"stringifiable"` slot encounters a T value — never silently.
   */
  readonly toString?: (value: T) => string;
  /** Optional registry of named functions usable in pipelines. */
  readonly funcs?: FuncMap;
}

// Per-evaluate context. Threaded through every internal method.
interface EvalContext<T> {
  readonly out: T[];
  readonly defines: ReadonlyMap<string, ListNode>;
  readonly source: string | undefined;
}

// [LAW:dataflow-not-control-flow] Pipeline-fed value, structurally
// distinguished from absence. Replaces an earlier `unknown` parameter
// where `undefined` was overloaded to mean both "no pipe" and "pipe of
// undefined" — a sentinel collision that produced arity-mismatched
// calls when a function legitimately returned `undefined`. The
// discriminator now drives the append decision; the value (including
// `undefined`) flows through unchanged.
type Piped = { readonly kind: "none" } | { readonly kind: "value"; readonly value: unknown };

const NO_PIPE: Piped = { kind: "none" };

/**
 * A parsed template bound to its parent engine.
 *
 * Template instances are immutable — `evaluate(scope)` may be called
 * any number of times with different scopes, matching the
 * "parse-once-eval-many" invariant from the epic spec. The `source`
 * property exposes the original template text for debugging /
 * diagnostics.
 *
 * Construct via `engine.parse(src)`. The constructor is private so
 * the public type surface need not reference internal AST shapes.
 */
// [LAW:one-source-of-truth] `internalCreateTemplate` is the *only*
// callable factory for Template. Captured from the static block below
// so that Engine (and only Engine) can construct Templates without
// exposing the parsed AST shape on the public type surface.
let internalCreateTemplate: <U>(source: string, evaluate: (scope: unknown) => U[]) => Template<U>;

export class Template<T> {
  readonly source: string;
  private readonly _evaluate: (scope: unknown) => T[];

  private constructor(source: string, evaluate: (scope: unknown) => T[]) {
    this.source = source;
    this._evaluate = evaluate;
  }

  static {
    internalCreateTemplate = <U>(source: string, evaluate: (scope: unknown) => U[]) =>
      new Template(source, evaluate);
  }

  evaluate(scope: unknown): T[] {
    return this._evaluate(scope);
  }
}

export class Engine<T> {
  private readonly fromString: (s: string) => T;
  // [LAW:single-enforcer] Stored alongside `fromString` so the engine
  // owns both halves of the text↔T boundary. Threaded into
  // `enforceArgTypes` so `"stringifiable"` slots probe with the same
  // function that downstream func bodies will re-use to flatten.
  private readonly toString: (value: unknown) => string;
  private readonly funcs: FuncMap;

  constructor(config: EngineConfig<T>) {
    this.fromString = config.fromString;
    // `toString` collides with `Object.prototype.toString`, so a plain
    // `config.toString ?? default` would silently bind the prototype
    // method when the consumer didn't pass anything. Check for an own
    // property explicitly so the fallback only fires for unconfigured
    // engines.
    const userToString = Object.hasOwn(config, "toString") ? config.toString : undefined;
    this.toString = (userToString ?? defaultToString) as (value: unknown) => string;
    // [LAW:single-enforcer] Built-ins live in one registry; consumer
    // funcs override on a per-name basis (this gives consumers an
    // escape hatch — desired).
    this.funcs = { ...defaultBuiltins(this.toString), ...(config.funcs ?? {}) };
  }

  /**
   * Parse a template source into a reusable Template handle.
   *
   * The returned Template is immutable; calling `evaluate(scope)` on
   * it any number of times with different scopes is safe and avoids
   * re-parsing.
   */
  parse(source: string): Template<T> {
    const parsed = parseSource(source);
    return internalCreateTemplate(parsed.source, (scope) => this.evalParsed(parsed, scope));
  }

  /**
   * Convenience sugar for `parse(src).evaluate.bind(template)`.
   *
   * Returns a closure that takes a scope and produces T[]. Useful when
   * the template is parsed once at module load and called many times.
   */
  compile(source: string): (scope: unknown) => T[] {
    const template = this.parse(source);
    return (scope: unknown) => template.evaluate(scope);
  }

  /**
   * Evaluate a parsed template against a scope value, producing T[].
   *
   * Accepts only Templates produced by `engine.parse(src)` so the
   * public type surface stays clear of internal AST shapes.
   */
  evaluate(template: Template<T>, scope: unknown): T[] {
    return template.evaluate(scope);
  }

  // [LAW:single-enforcer] All evaluation flows through here; the
  // Template closure built in `parse()` calls back into this method.
  private evalParsed(parsed: ParseResult, scope: unknown): T[] {
    const out: T[] = [];
    const root = rootScope(scope);
    const ctx: EvalContext<T> = {
      out,
      defines: parsed.defines,
      source: parsed.source,
    };
    this.evalList(parsed.root, root, ctx);
    return out;
  }

  // -------------------------------------------------------------------
  // Statement-level dispatch (output-producing nodes).
  // -------------------------------------------------------------------

  private evalList(node: ListNode, scope: Scope, ctx: EvalContext<T>): void {
    for (const child of node.nodes) {
      this.evalNode(child, scope, ctx);
    }
  }

  private evalNode(node: Node, scope: Scope, ctx: EvalContext<T>): void {
    switch (node.type) {
      case "Text":
        ctx.out.push(this.fromString(node.text));
        return;
      case "Comment":
        return;
      case "Action": {
        const value = this.evalAction(node, scope, ctx);
        // Per Go's spec, actions whose pipeline declares variables
        // (`{{ $x := pipe }}`) contribute no output — they're pure
        // assignment statements. Only assignment-free actions emit.
        if (node.pipe.decls.length === 0) this.emitFromValue(value, ctx);
        return;
      }
      case "List":
        this.evalList(node, scope, ctx);
        return;
      case "If":
        this.evalIf(node, scope, ctx);
        return;
      case "Range":
        this.evalRange(node, scope, ctx);
        return;
      case "With":
        this.evalWith(node, scope, ctx);
        return;
      case "Template":
        this.evalTemplateInvoke(node, scope, ctx);
        return;
      case "Block":
        this.evalBlock(node, scope, ctx);
        return;
      case "Pipe":
      case "Command":
      case "Identifier":
      case "Field":
      case "Variable":
      case "Chain":
      case "Dot":
      case "Nil":
      case "Bool":
      case "Number":
      case "String":
        // These are *expression* nodes — they should never appear as
        // statements at list level. If one does, the AST is malformed.
        throw new EvalError(`unexpected ${node.type} at statement position`, node.pos, {
          source: ctx.source,
        });
      default:
        assertNever(node);
    }
  }

  // -------------------------------------------------------------------
  // Control flow.
  // -------------------------------------------------------------------

  private evalIf(
    node: { pipe: PipeNode; list: ListNode; elseList?: ListNode },
    scope: Scope,
    ctx: EvalContext<T>,
  ): void {
    const cond = this.evalPipe(node.pipe, scope, ctx);
    if (isTruthy(cond)) {
      this.evalList(node.list, scope, ctx);
    } else if (node.elseList) {
      this.evalList(node.elseList, scope, ctx);
    }
  }

  private evalWith(
    node: { pipe: PipeNode; list: ListNode; elseList?: ListNode },
    scope: Scope,
    ctx: EvalContext<T>,
  ): void {
    const value = this.evalPipe(node.pipe, scope, ctx);
    if (isTruthy(value)) {
      const child = pushScope(scope, value);
      this.evalList(node.list, child, ctx);
    } else if (node.elseList) {
      this.evalList(node.elseList, scope, ctx);
    }
  }

  private evalRange(
    node: { pipe: PipeNode; list: ListNode; elseList?: ListNode; pos: Pos },
    scope: Scope,
    ctx: EvalContext<T>,
  ): void {
    // For `range`, the pipeline's declarations bind to (key, value)
    // *per iteration*, not to the iterable as a whole. We evaluate the
    // pipe with its decls suppressed, then handle the bindings here.
    const value = this.evalPipeWithoutDecls(node.pipe, scope, ctx);
    const decls = node.pipe.decls;

    const entries = enumerateForRange(value);
    if (entries.length === 0) {
      if (node.elseList) this.evalList(node.elseList, scope, ctx);
      return;
    }
    for (const [key, item] of entries) {
      const child = pushScope(scope, item);
      if (decls.length === 1) {
        const name = decls[0]?.idents[0] ?? "$";
        declareVar(child, name, item);
      } else if (decls.length >= 2) {
        const k = decls[0]?.idents[0] ?? "$";
        const v = decls[1]?.idents[0] ?? "$";
        declareVar(child, k, key);
        declareVar(child, v, item);
      }
      this.evalList(node.list, child, ctx);
    }
  }

  private evalTemplateInvoke(
    node: { name: string; pipe?: PipeNode; pos: Pos },
    scope: Scope,
    ctx: EvalContext<T>,
  ): void {
    const tpl = ctx.defines.get(node.name);
    if (!tpl) {
      throw new EvalError(`template ${JSON.stringify(node.name)} is not defined`, node.pos, {
        source: ctx.source,
      });
    }
    const arg = node.pipe ? this.evalPipe(node.pipe, scope, ctx) : scope.dot;
    const child = pushScope(scope, arg);
    this.evalList(tpl, child, ctx);
  }

  private evalBlock(
    node: { name: string; pipe?: PipeNode; list: ListNode; pos: Pos },
    scope: Scope,
    ctx: EvalContext<T>,
  ): void {
    // A block invokes the same-named template if one is registered (or
    // that registration came from the block itself at parse time).
    // The dot for the block body is the pipe's value when present.
    const arg = node.pipe ? this.evalPipe(node.pipe, scope, ctx) : scope.dot;
    const child = pushScope(scope, arg);
    const tpl = ctx.defines.get(node.name) ?? node.list;
    this.evalList(tpl, child, ctx);
  }

  // -------------------------------------------------------------------
  // Expression-level dispatch (value-producing).
  // -------------------------------------------------------------------

  private evalAction(node: ActionNode, scope: Scope, ctx: EvalContext<T>): unknown {
    return this.evalPipe(node.pipe, scope, ctx);
  }

  private evalPipe(pipe: PipeNode, scope: Scope, ctx: EvalContext<T>): unknown {
    if (pipe.cmds.length === 0) {
      throw new EvalError("empty pipeline", pipe.pos, { source: ctx.source });
    }
    let value: unknown = this.evalCommand(pipe.cmds[0] as CommandNode, scope, ctx, NO_PIPE);
    for (let i = 1; i < pipe.cmds.length; i++) {
      const next = pipe.cmds[i] as CommandNode;
      value = this.evalCommand(next, scope, ctx, { kind: "value", value });
    }

    // Apply variable declarations / assignments after the pipe is
    // fully evaluated. Multi-decl tuple semantics for `range` are
    // handled inside `evalRange` (which calls `evalPipeWithoutDecls`).
    if (pipe.decls.length > 0) {
      for (const decl of pipe.decls) {
        const name = decl.idents[0] ?? "$";
        declareVar(scope, name, value);
      }
    }
    return value;
  }

  private evalPipeWithoutDecls(pipe: PipeNode, scope: Scope, ctx: EvalContext<T>): unknown {
    // Synthesise a pipe with empty decls so the standard `evalPipe`
    // doesn't attempt the (single-binding) declaration. `evalRange`
    // handles its own multi-binding semantics.
    const stripped: PipeNode = {
      type: "Pipe",
      pos: pipe.pos,
      decls: [],
      isAssign: false,
      cmds: pipe.cmds,
    };
    return this.evalPipe(stripped, scope, ctx);
  }

  private evalCommand(cmd: CommandNode, scope: Scope, ctx: EvalContext<T>, piped: Piped): unknown {
    if (cmd.args.length === 0) {
      throw new EvalError("empty command", cmd.pos, { source: ctx.source });
    }
    const head = cmd.args[0] as Node;

    if (head.type !== "Identifier") {
      if (cmd.args.length > 1) {
        throw new EvalError(
          `cannot apply arguments to a ${head.type} primary; only functions take arguments`,
          cmd.pos,
          { source: ctx.source },
        );
      }
      return this.evalPrimary(head, scope, ctx);
    }

    const fn = this.funcs[head.ident];
    if (!fn)
      throw new FuncNotFoundError(head.ident, head.pos, {
        source: ctx.source,
        available: Object.keys(this.funcs),
      });

    const argNodes = cmd.args.slice(1);

    // [LAW:dataflow-not-control-flow] One dispatch path. Lazy funcs
    // receive thunks (so they can short-circuit), eager funcs receive
    // values — that's the only difference, and it's encoded in the
    // shape of `args`, not in whether `enforceArgTypes` runs. Lazy
    // funcs declare `argTypes: ["any"]` so the validation is a no-op
    // against thunks.
    const lazy = isLazy(fn);
    const args: unknown[] = argNodes.map((n) =>
      lazy ? () => this.evalPrimary(n, scope, ctx) : this.evalPrimary(n, scope, ctx),
    );
    // [LAW:dataflow-not-control-flow] The discriminator drives whether
    // the pipe value is appended; `undefined` flows through as a real
    // value when present, instead of colliding with "no pipe".
    if (piped.kind === "value") {
      const v = piped.value;
      args.push(lazy ? () => v : v);
    }

    enforceArgTypes(
      head.ident,
      fn.argTypes,
      args,
      cmd.pos,
      ctx.source,
      this.toString,
      fn.argTypePattern,
    );
    // [LAW:single-enforcer] One cast at the dispatch site. `TemplateFunc.fn`
    // declares `(...args: never[]) => unknown` so consumer impls can narrow
    // their parameter types; we erase that here, having already validated
    // the runtime types via `enforceArgTypes`.
    try {
      return (fn.fn as (...a: unknown[]) => unknown)(...args);
    } catch (e) {
      // [LAW:single-enforcer] The dispatch site is the *one* place that
      // owns call-site context (pos, source). Funcs that validate nested
      // structure (e.g. list elements, alternating variadic positions)
      // throw TypeMismatchError without pos info; we re-emit with the
      // call-site pos so the snippet points at the failing call.
      if (e instanceof TypeMismatchError) {
        throw new TypeMismatchError(
          e.funcName,
          e.argIndex,
          e.expected,
          e.receivedSummary,
          cmd.pos,
          { source: ctx.source },
        );
      }
      throw e;
    }
  }

  private evalPrimary(node: Node, scope: Scope, ctx: EvalContext<T>): unknown {
    switch (node.type) {
      case "Dot":
        return scope.dot;
      case "Nil":
        return null;
      case "Bool":
        return node.value;
      case "Number":
        return numberValue(node);
      case "String":
        return node.value;
      case "Field":
        return this.resolveFieldChain(scope.dot, node.idents, node.pos, ctx);
      case "Variable":
        return this.resolveVariable(node.idents, scope, node.pos, ctx);
      case "Identifier": {
        const fn = this.funcs[node.ident];
        if (!fn)
          throw new FuncNotFoundError(node.ident, node.pos, {
            source: ctx.source,
            available: Object.keys(this.funcs),
          });
        enforceArgTypes(
          node.ident,
          fn.argTypes,
          [],
          node.pos,
          ctx.source,
          this.toString,
          fn.argTypePattern,
        );
        return (fn.fn as () => unknown)();
      }
      case "Chain":
        return this.resolveFieldChain(
          this.evalPrimary(node.node, scope, ctx),
          node.fields,
          node.pos,
          ctx,
        );
      case "Pipe":
        return this.evalPipe(node, scope, ctx);
      default:
        throw new EvalError(`cannot evaluate ${node.type} as a value`, node.pos, {
          source: ctx.source,
        });
    }
  }

  // -------------------------------------------------------------------
  // Field chains and variables.
  // -------------------------------------------------------------------

  private resolveFieldChain(
    receiver: unknown,
    idents: readonly string[],
    pos: Pos,
    ctx: EvalContext<T>,
  ): unknown {
    const result = walkFieldChain(receiver, idents);
    if (result === MISSING) {
      throw new MissingFieldError(idents, pos, { source: ctx.source });
    }
    return result;
  }

  private resolveVariable(
    idents: readonly string[],
    scope: Scope,
    pos: Pos,
    ctx: EvalContext<T>,
  ): unknown {
    const head = idents[0] ?? "$";
    if (head === "$") {
      const tail = idents.slice(1);
      return tail.length === 0 ? scope.root : this.resolveFieldChain(scope.root, tail, pos, ctx);
    }
    const lookup = lookupVar(scope, head);
    if (!lookup.found) {
      throw new EvalError(`undefined variable ${head}`, pos, { source: ctx.source });
    }
    const tail = idents.slice(1);
    return tail.length === 0 ? lookup.value : this.resolveFieldChain(lookup.value, tail, pos, ctx);
  }

  // -------------------------------------------------------------------
  // Output stream.
  // -------------------------------------------------------------------

  private emitFromValue(value: unknown, ctx: EvalContext<T>): void {
    // [LAW:dataflow-not-control-flow] No skip-when-null branch. The
    // emit always runs; the value (including null/undefined) drives
    // what is pushed. Matches Go's text/template, which emits
    // `<no value>` for nil pipelines uniformly.
    if (value === null || value === undefined) {
      ctx.out.push(this.fromString("<no value>"));
      return;
    }
    if (typeof value === "string") {
      ctx.out.push(this.fromString(value));
      return;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      ctx.out.push(this.fromString(String(value)));
      return;
    }
    // Arrays / Maps / plain objects: format Go-like (`[a b c]`, `map[k:v]`,
    // `{f1 f2}`) when the value lands in a string-output stream. This
    // matches Go's `fmt.Sprintf("%v", v)` shape for the common cases
    // and keeps the conformance corpus byte-equal.
    if (Array.isArray(value)) {
      ctx.out.push(this.fromString(formatArrayLikeGo(value)));
      return;
    }
    if (value instanceof Map) {
      ctx.out.push(this.fromString(formatMapLikeGo(value)));
      return;
    }
    ctx.out.push(value as T);
  }
}

function formatArrayLikeGo(arr: readonly unknown[]): string {
  return `[${arr.map(formatScalarLikeGo).join(" ")}]`;
}

function formatMapLikeGo(m: ReadonlyMap<unknown, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of m) {
    parts.push(`${formatScalarLikeGo(k)}:${formatScalarLikeGo(v)}`);
  }
  return `map[${parts.join(" ")}]`;
}

function formatScalarLikeGo(v: unknown): string {
  if (v === null || v === undefined) return "<nil>";
  if (Array.isArray(v)) return formatArrayLikeGo(v);
  if (v instanceof Map) return formatMapLikeGo(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// Convenience constructor matching the future public-API shape (.api.1).
// ---------------------------------------------------------------------------

export function createEngine<T>(config: EngineConfig<T>): Engine<T> {
  return new Engine(config);
}

// ---------------------------------------------------------------------------
// No-silent-flatten guard.
//
// [LAW:single-enforcer] This is the *one* place where argument types
// are validated against runtime values. Every function call routes
// through here.
// ---------------------------------------------------------------------------

// Exported for the deep-import universal-property harness (see
// `test/conformance/no-silent-flatten-universal.test.ts`). Not part of
// the public stability surface — `src/index.ts` does not re-export it.
//
// `toString` is optional so the harness (and any other deep-import
// caller) keeps compiling unchanged. When omitted, the default
// stringifier is used; that only affects `"stringifiable"` slots, none
// of which appear in any registration as of template-laws-3gt.1.
export function enforceArgTypes(
  funcName: string,
  argTypes: readonly ArgType[],
  values: readonly unknown[],
  pos: Pos,
  src: string | undefined,
  toString: (value: unknown) => string = defaultToString,
  pattern?: "alternating",
): void {
  // [LAW:dataflow-not-control-flow] No short-circuit. The shape of work
  // is fixed: validate every positional value against its declared
  // type. Variability lives in `argTypes` (use ["any"] as the explicit
  // permissive escape), never in whether validation runs.
  //
  // [LAW:single-enforcer] Slot lookup is a single function — the
  // variadic-overflow rule (trailing-repeat by default, modulo cycle
  // when `pattern === "alternating"`) lives here once, not duplicated
  // at the loop body. See template-laws-3gt.3 for the alternation
  // motivation (`dict`'s string/value kv pairing).
  const lookup = makeSlotLookup(argTypes, pattern);
  let firstOrdered = -1;
  let firstComparable = -1;
  for (let i = 0; i < values.length; i++) {
    const declared = lookup(i);
    const value = values[i];
    if (!matchesArgType(declared, value, toString)) {
      throw new TypeMismatchError(
        funcName,
        i + 1,
        humanArgType(declared),
        describeValue(value),
        pos,
        { source: src },
      );
    }
    // [LAW:single-enforcer] The cross-slot ordering rule lives here,
    // alongside the per-slot type rule, so "what counts as a valid
    // comparison" has a single enforcer. Each "ordered" slot must
    // share a kind with the first "ordered" slot in the same call,
    // with number↔bigint bridged.
    if (declared === "ordered") {
      if (firstOrdered === -1) {
        firstOrdered = i;
      } else if (!sameOrderedKind(values[firstOrdered], value)) {
        throw new TypeMismatchError(
          funcName,
          i + 1,
          `${humanArgType("ordered")} of the same kind as ${describeValue(values[firstOrdered])}`,
          describeValue(value),
          pos,
          { source: src },
        );
      }
    }
    // [LAW:single-enforcer] Same-kind rule for "comparable" — Go's
    // `text/template` errors on `eq "foo" 1`. number↔bigint bridged;
    // nil acts as a wildcard so `eq .field nil` works regardless of
    // .field's kind.
    if (declared === "comparable") {
      if (firstComparable === -1) {
        firstComparable = i;
      } else if (!sameComparableKind(values[firstComparable], value)) {
        throw new TypeMismatchError(
          funcName,
          i + 1,
          `${humanArgType("comparable")} of the same kind as ${describeValue(values[firstComparable])}`,
          describeValue(value),
          pos,
          { source: src },
        );
      }
    }
  }
}

// [LAW:dataflow-not-control-flow] The variadic-overflow rule is encoded
// as a function that maps an arg index to its declared kind, picked
// once per call. The loop in `enforceArgTypes` then has the same shape
// for every func — no per-iteration `if (pattern === "alternating")`.
function makeSlotLookup(
  argTypes: readonly ArgType[],
  pattern: "alternating" | undefined,
): (i: number) => ArgType {
  if (argTypes.length === 0) {
    // Funcs registered with `argTypes: []` are zero-arity at the gate.
    // The loop only runs when `values.length > argTypes.length`, which
    // is itself a registration bug — fall back to "any" so the loop
    // does not throw on a stale zero-arity registration.
    return () => "any";
  }
  if (pattern === "alternating") {
    const len = argTypes.length;
    return (i) => argTypes[i % len] as ArgType;
  }
  const trailing = argTypes[argTypes.length - 1] as ArgType;
  return (i) => (i < argTypes.length ? (argTypes[i] as ArgType) : trailing);
}

function matchesArgType(
  declared: ArgType,
  value: unknown,
  toString: (value: unknown) => string,
): boolean {
  switch (declared) {
    case "any":
    case "truthy":
    case "reflective":
    case "value":
      // [LAW:dataflow-not-control-flow] Same matcher behavior as
      // "any"; the *label* carries reader-facing intent so a future
      // grep can distinguish "we accept anything because we inspect
      // the type" from "we accept anything because we run truthiness"
      // from "any escape-hatch leftover". Migration target for .8.
      return true;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" || typeof value === "bigint";
    case "bool":
      return typeof value === "boolean";
    case "ordered":
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "boolean"
      );
    case "T":
      return (
        value !== null &&
        value !== undefined &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean" &&
        typeof value !== "bigint" &&
        typeof value !== "symbol"
      );
    case "list":
      // Go-parity: a string is not a list to sprig, even though it is
      // iterable. Excluding string here forces consumers to spell out
      // string-vs-list intent at the slot.
      return Array.isArray(value);
    case "dict":
      // Plain object only. Maps, arrays, Sets, class instances, and
      // null are not "dicts" — the dict slot expects bag-of-keys
      // semantics with `Object.keys` / `Record<string, unknown>` shape.
      return isPlainObject(value);
    case "sized":
      return (
        typeof value === "string" ||
        Array.isArray(value) ||
        value instanceof Map ||
        value instanceof Set ||
        isPlainObject(value)
      );
    case "comparable":
      // [LAW:one-source-of-truth] Membership is "anything JSON-shaped":
      // ordered primitives, nil, arrays, Maps, Sets, plain objects.
      // Functions and symbols are rejected. The cross-slot same-kind
      // rule (with nil-as-wildcard) is enforced in `enforceArgTypes`
      // alongside the per-slot match.
      return (
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "boolean" ||
        Array.isArray(value) ||
        value instanceof Map ||
        value instanceof Set ||
        isPlainObject(value)
      );
    case "callable":
      return typeof value === "function";
    case "collection":
      // Receiver shape for `index`. Sets and class instances are
      // rejected (Sets aren't keyed; class instances aren't sprig
      // dicts). Nil is rejected so the body never has to defend.
      return (
        typeof value === "string" ||
        Array.isArray(value) ||
        value instanceof Map ||
        isPlainObject(value)
      );
    case "index-key":
      // Key shape for `index`. The body decides which collection kind
      // a key actually fits (array wants integer; object wants string;
      // Map's get accepts the key as-is for whatever it stores).
      return typeof value === "string" || typeof value === "number" || typeof value === "bigint";
    case "stringifiable": {
      // Probe (do not transform). String passes through trivially —
      // avoids invoking the consumer's `toString` for the common case.
      // For non-strings, attempt the conversion: a successful return
      // means the value can flatten, a throw means it cannot. The
      // matcher reports the boolean; downstream func bodies (.6) call
      // `engine.toString` again to actually flatten.
      if (typeof value === "string") return true;
      try {
        toString(value);
        return true;
      } catch {
        return false;
      }
    }
    case "serializable":
      // Runtime-validate JSON encodability. `JSON.stringify` returns
      // `undefined` for functions/symbols and throws on circular refs;
      // either result fails the gate.
      return isJsonSerializable(value);
  }
}

// Default flattener for engines that don't supply `toString`. Strings
// flow through unchanged (the `T = string` happy path). Primitives
// (number/bigint/boolean) and nil get their natural string form so
// vanilla string-engine consumers can `print 1`, `printf "%s" true`
// etc. without configuring a flattener. Anything else — arrays,
// objects, Maps, Sets, functions, symbols — is the actual "typed-T
// without consumer flattener" case the README contract is about, and
// throws a TypeMismatchError. `evalCommand` wraps and re-emits with
// the proper call-site pos (see [LAW:single-enforcer] above).
function defaultToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "<nil>";
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  throw new TypeMismatchError(
    "<engine.toString>",
    1,
    "string (or a consumer-supplied toString that flattens T)",
    describeValue(value),
    { line: 0, column: 0, offset: 0 },
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Map || value instanceof Set) return false;
  // Reject typed arrays, Dates, RegExps, and other built-ins by
  // requiring a null prototype or the plain Object prototype.
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isJsonSerializable(value: unknown): boolean {
  try {
    const encoded = JSON.stringify(value);
    // `JSON.stringify` returns `undefined` for top-level functions /
    // symbols / undefined; treat that as "not serializable".
    return encoded !== undefined;
  } catch {
    // Circular references or BigInt land here.
    return false;
  }
}

// Same-kind check for two values declared `ordered`. Number and bigint
// are bridged because compare() handles them as one numeric kind.
function sameOrderedKind(a: unknown, b: unknown): boolean {
  if (typeof a === typeof b) return true;
  if (typeof a === "number" && typeof b === "bigint") return true;
  if (typeof a === "bigint" && typeof b === "number") return true;
  return false;
}

// Same-kind check for two "comparable" slots. Kinds: nil | string |
// number (number/bigint bridged) | boolean | array | map | set |
// object. nil is a wildcard, matching any kind.
function sameComparableKind(a: unknown, b: unknown): boolean {
  const ka = comparableKind(a);
  const kb = comparableKind(b);
  if (ka === "nil" || kb === "nil") return true;
  return ka === kb;
}

function comparableKind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "string";
  if (typeof v === "number" || typeof v === "bigint") return "number";
  if (typeof v === "boolean") return "boolean";
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "map";
  if (v instanceof Set) return "set";
  return "object";
}

function humanArgType(t: ArgType): string {
  switch (t) {
    case "T":
      return "T (consumer-defined fragment)";
    case "ordered":
      return "orderable primitive";
    case "list":
      return "list";
    case "dict":
      return "dict (plain object)";
    case "sized":
      return "sized value (string, list, map, set, or dict)";
    case "comparable":
      return "comparable value (orderable primitive, nil, list, dict, Map, or Set)";
    case "stringifiable":
      return "stringifiable value (string or convertible via the engine's toString)";
    case "callable":
      return "callable (function value)";
    case "collection":
      return "collection (string, array, Map, or dict)";
    case "index-key":
      return "index key (number, bigint, or string)";
    case "serializable":
      return "JSON-serializable value";
    case "truthy":
    case "reflective":
    case "value":
    case "any":
    case "string":
    case "number":
    case "bool":
      return t;
  }
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Map) return "Map";
  return typeof value;
}

// ---------------------------------------------------------------------------
// Range support — iteration helpers.
// ---------------------------------------------------------------------------

/**
 * Produce [key, value] entries for a `range` operand.
 *
 * - Arrays / typed arrays / strings: numeric index → element
 * - Maps and plain objects: entries sorted by key. Matches Go's
 *   `text/template`, which sorts map keys via `internal/fmtsort`
 *   before iterating — same input always produces the same byte
 *   output. Strings sort lexically; numbers numerically.
 * - Sets: index → element (Go ranges over channels but we map to Set
 *   for symmetry with arrays/iteration)
 * - null/undefined: empty
 */
function enumerateForRange(value: unknown): readonly (readonly [unknown, unknown])[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map((v, i) => [i, v] as const);
  if (typeof value === "string") return [...value].map((c, i) => [i, c] as const);
  if (value instanceof Map) return sortMapEntries([...value.entries()]);
  if (value instanceof Set) return [...value.values()].map((v, i) => [i, v] as const);
  if (typeof value === "object") {
    return sortMapEntries(Object.entries(value as Record<string, unknown>));
  }
  return [];
}

// Sort map / object entries by key to match Go's text/template
// `fmtsort` ordering. Numbers compare numerically, strings lexically,
// mixed kinds fall back to string-ordering of the key. The compare is
// stable enough for byte-equality conformance against Go.
function sortMapEntries(
  entries: readonly (readonly [unknown, unknown])[],
): readonly (readonly [unknown, unknown])[] {
  return [...entries].sort((a, b) => compareMapKeys(a[0], b[0]));
}

function compareMapKeys(a: unknown, b: unknown): number {
  const an = typeof a === "number" || typeof a === "bigint";
  const bn = typeof b === "number" || typeof b === "bigint";
  if (an && bn) {
    const ax = typeof a === "bigint" ? Number(a) : (a as number);
    const bx = typeof b === "bigint" ? Number(b) : (b as number);
    return ax === bx ? 0 : ax < bx ? -1 : 1;
  }
  const as = String(a);
  const bs = String(b);
  return as === bs ? 0 : as < bs ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Numeric-literal helper.
// ---------------------------------------------------------------------------

function numberValue(n: {
  readonly intValue?: bigint;
  readonly floatValue?: number;
  readonly complexValue?: readonly [number, number];
}): unknown {
  if (n.intValue !== undefined) {
    const bi = n.intValue;
    if (bi >= BigInt(Number.MIN_SAFE_INTEGER) && bi <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(bi);
    }
    return bi;
  }
  if (n.floatValue !== undefined) return n.floatValue;
  if (n.complexValue !== undefined) return n.complexValue;
  // [LAW:one-source-of-truth] The AST contract guarantees one of
  // intValue/floatValue/complexValue is set on a NumberNode. Reaching
  // here means the parser produced a NumberNode missing all three —
  // an internal invariant break, not a runtime input we should
  // silently coerce to undefined.
  throw new Error(
    "internal: NumberNode has none of intValue/floatValue/complexValue — parser invariant violated",
  );
}
