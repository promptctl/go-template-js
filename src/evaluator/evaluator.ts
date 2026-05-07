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
 * - "ordered" — orderable primitive (string, number, bigint, boolean).
 *   When two or more "ordered" slots appear in the same call, all of
 *   them must share a kind, with `number` and `bigint` bridged. Used
 *   by `lt`/`le`/`gt`/`ge` to match Go's `text/template` rule that
 *   ordering operands have the same type.
 */
export type ArgType = "string" | "number" | "bool" | "T" | "any" | "ordered";

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
}

export type FuncMap = Record<string, TemplateFunc>;

export interface EngineConfig<T> {
  /** Convert a text literal (or string-returning function result) into T. */
  readonly fromString: (s: string) => T;
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
  private readonly funcs: FuncMap;

  constructor(config: EngineConfig<T>) {
    this.fromString = config.fromString;
    // [LAW:single-enforcer] Built-ins live in one registry; consumer
    // funcs override on a per-name basis (this gives consumers an
    // escape hatch — desired).
    this.funcs = { ...defaultBuiltins(), ...(config.funcs ?? {}) };
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

    enforceArgTypes(head.ident, fn.argTypes, args, cmd.pos, ctx.source);
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
        enforceArgTypes(node.ident, fn.argTypes, [], node.pos, ctx.source);
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
export function enforceArgTypes(
  funcName: string,
  argTypes: readonly ArgType[],
  values: readonly unknown[],
  pos: Pos,
  src: string | undefined,
): void {
  // [LAW:dataflow-not-control-flow] No short-circuit. The shape of work
  // is fixed: validate every positional value against its declared
  // type. Variability lives in `argTypes` (use ["any"] as the explicit
  // permissive escape), never in whether validation runs.
  const trailing = argTypes[argTypes.length - 1] ?? "any";
  let firstOrdered = -1;
  for (let i = 0; i < values.length; i++) {
    const declared = argTypes[i] ?? trailing;
    const value = values[i];
    if (!matchesArgType(declared, value)) {
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
  }
}

function matchesArgType(declared: ArgType, value: unknown): boolean {
  switch (declared) {
    case "any":
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

function humanArgType(t: ArgType): string {
  if (t === "T") return "T (consumer-defined fragment)";
  if (t === "ordered") return "orderable primitive";
  return t;
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
