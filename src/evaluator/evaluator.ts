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
  EvalError,
  FailError,
  FuncNotFoundError,
  MissingFieldError,
  TypeMismatchError,
} from "../errors.js";
import {
  type ActionNode,
  assertNever,
  type CommandNode,
  type ListNode,
  type Node,
  type PipeNode,
} from "../parser/ast.js";
import type { Delims } from "../parser/lexer.js";
import { type ParseResult, parse as parseSource } from "../parser/parser.js";
import type { Pos } from "../parser/pos.js";
import { MISSING, walkFieldChain } from "./access.js";
import { defaultBuiltins } from "./builtins.js";
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
 * - "int"    — validate-AND-parse integer carrier. Accepts any finite
 *   `number` and any `bigint` whose `Number()` is safe-integer-
 *   representable; rejects `NaN`, `±Infinity`, and precision-losing
 *   bigints. The gate normalizes `values[i]` to `Math.trunc(Number(v))`
 *   so bodies see `number`. Used by `add`, `sub`, `mul`, `mod`, `max`,
 *   `min`, the built-in `slice`'s index slots, `chunk`, `splitn`,
 *   `repeat`. Added by epic template-variance-num-carrier-hfv.
 * - "float"  — validate-AND-parse float carrier. Accepts any `number`
 *   (including `NaN`/`±Infinity` — legitimate IEEE-754 floats) and any
 *   `bigint` whose `Number()` is finite (overflow-to-Infinity rejected
 *   as a magnitude failure). The gate normalizes to `Number(v)` so
 *   bodies see `number`. Used by `addf`, `subf`, `mulf`, `divf`,
 *   `maxf`, `minf`. Added by epic template-variance-num-carrier-hfv.
 * - "bool"   — must be `typeof "boolean"`.
 * - "T"      — opaque caller-defined T; treated as "anything that is
 *   not a string". The guard does no further checking.
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
 * - "sliceable" — string | array. Receiver shape for `slice`. Folded
 *   into template-laws-3gt.8 alongside the intent-named migration so
 *   .9 could delete `"any"` from the union.
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
 *
 * [LAW:make-it-impossible] `"any"` is intentionally absent from this
 * union. Every slot must engage with the type system. If a slot is
 * genuinely heterogeneous, use the kind that documents the reason
 * (`"truthy"`, `"reflective"`, `"serializable"`, `"value"`,
 * `"callable"`). The history for this decision lives in epic
 * template-laws-3gt.
 */
export type ArgType =
  | "string"
  // [LAW:types-are-the-program] "int" and "float" are validate-AND-parse
  // numeric carriers. The matcher's membership predicate IS the body's
  // contract — neither slot accepts "anything `typeof number|bigint`":
  //   - "int" admits only carriers that survive normalization as a
  //     finite integer-valued `number`: finite numbers, and bigints
  //     whose `Number()` conversion is safe-integer-representable.
  //     NaN, Infinity, and precision-losing bigints are rejected at
  //     the gate so the body's "I receive an integer" assumption is
  //     a theorem, not a defense.
  //   - "float" admits any number (NaN/Infinity are legitimate IEEE
  //     754 floats; Go's float64 has them too) and bigints whose
  //     `Number()` is finite. The only rejected bigint is one whose
  //     conversion overflows to Infinity.
  // After membership is proven the gate mutates `values[i]` to a
  // `number` carrier ("int": `Math.trunc(Number(v))`; "float":
  // `Number(v)`). Mirrors the "liftable" precedent: the slot is both
  // the membership rule and the parse step. Added by epic
  // template-variance-num-carrier-hfv.1; tightened by .1.1; the legacy
  // permissive "number" slot was retired in .4 once all consumers
  // migrated (.2/.3) — every numeric slot now picks the integer-or-
  // float carrier explicitly.
  | "int"
  | "float"
  | "bool"
  | "T"
  | "ordered"
  | "list"
  | "dict"
  | "sized"
  | "comparable"
  | "stringifiable"
  | "liftable"
  | "callable"
  | "collection"
  | "index-key"
  | "sliceable"
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
   * Default (omitted): the trailing slot repeats. `["string", "value"]`
   * means "first arg string, every arg after is value (heterogeneous)".
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

/**
 * Policy for missing field/map-key access — mirrors Go's
 * `text/template` `Option("missingkey=...")`:
 *
 * - `"default"` (Go's `missingkey=default` / `missingkey=invalid`):
 *   missing access yields `undefined`; emitted output is `<no value>`.
 *   This is the engine default, matching Go's `text/template` default.
 * - `"zero"` (Go's `missingkey=zero`): in Go, returns the zero value of
 *   the map's element type. JavaScript has no static value-type info,
 *   so the runtime cannot synthesize a typed zero — the option is
 *   accepted for API parity and behaves identically to `"default"`.
 *   Use sprig `default` (`{{ .x | default "" }}`) when you want a
 *   typed-zero substitute at the use site.
 * - `"error"` (Go's `missingkey=error`): missing access throws
 *   `MissingFieldError`. Use this in environments where a missing key
 *   indicates a scope-construction bug that should fail loud.
 */
export type MissingKeyOption = "default" | "zero" | "error";

// [LAW:one-source-of-truth] The valid-set lives next to the type it
// validates. The `Engine` constructor's boundary check consumes this;
// no other site decides what counts as a valid policy value.
const VALID_MISSING_KEYS: ReadonlySet<MissingKeyOption> = new Set(["default", "zero", "error"]);

// [LAW:types-are-the-program] The TS union forbids invalid values at
// compile time; this is the JS-boundary mirror of the same theorem so
// a typo from a JS caller (or an `as`-cast TS caller) fails loud at
// construct time instead of silently disabling the policy.
function validateMissingKey(value: MissingKeyOption | undefined): MissingKeyOption {
  if (value === undefined) return "default";
  if (VALID_MISSING_KEYS.has(value)) return value;
  throw new Error(
    `EngineConfig.missingKey: expected "default" | "zero" | "error", got ${describeBoundaryValue(value)}`,
  );
}

// [LAW:one-type-per-behavior] Shared safe formatter for boundary
// diagnostics — every validator that rejects an out-of-shape JS value
// uses this to describe what was actually passed. `JSON.stringify`
// would have thrown on bigint or cyclic inputs, swapping the intended
// diagnostic for an unrelated TypeError; the diagnostic must survive
// any value the caller might mis-pass.
function describeBoundaryValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return "[Function]";
  return `[${typeof value}]`;
}

// [LAW:one-source-of-truth] `Delims` is canonical in `parser/lexer.ts`
// (the lowest layer that consumes it). Re-exported here so consumers
// reaching `EngineConfig` see the type in the same module without
// needing to import from internal paths.
export type { Delims };

// [LAW:types-are-the-program] The TS interface is the canonical shape;
// this is the JS-boundary mirror — a typo'd or partially-set object
// from a JS caller (or an `as`-cast TS caller) fails loud at construct
// time instead of producing pathological tokenization later. Returns
// `undefined` for "no override" so the parser falls back to its own
// default and we never need a separate "are delims set" boolean.
function validateDelims(value: Delims | undefined): Delims | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `EngineConfig.delims: expected { left, right } object, got ${describeBoundaryValue(value)}`,
    );
  }
  if (typeof value.left !== "string" || value.left.length === 0) {
    throw new Error(
      `EngineConfig.delims.left: expected non-empty string, got ${describeBoundaryValue(value.left)}`,
    );
  }
  if (typeof value.right !== "string" || value.right.length === 0) {
    throw new Error(
      `EngineConfig.delims.right: expected non-empty string, got ${describeBoundaryValue(value.right)}`,
    );
  }
  return { left: value.left, right: value.right };
}

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
  /**
   * PRNG source for `sprigRandom` functions. Defaults to `Math.random`.
   * Supply a seeded generator for reproducible templates.
   *
   * [LAW:single-enforcer] One config field owns the randomness source;
   * pass this to `sprigRandom(config.random)` when composing a full
   * sprig engine so the seam is wired once, not per-function.
   */
  readonly random?: () => number;
  /**
   * Clock source for `sprigDatetime` functions. Defaults to
   * `() => new Date()`. Supply a frozen clock for deterministic test
   * output.
   *
   * [LAW:single-enforcer] One config field owns the time source; pass
   * this to `sprigDatetime(config.clock)` when composing a full sprig
   * engine so the seam is wired once, not per-function.
   */
  readonly clock?: () => Date;
  /**
   * Policy for missing field / map-key access. Defaults to `"default"`
   * (matching Go's `text/template` default — silent `<no value>`). See
   * `MissingKeyOption` for the full enum semantics.
   *
   * [LAW:single-enforcer] One config field owns the policy; the
   * `resolveFieldChain` gate is the only site that consults it.
   * [LAW:dataflow-not-control-flow] The policy is data flowing into a
   * fixed gate, not a branch sprinkled across accessors.
   */
  readonly missingKey?: MissingKeyOption;
  /**
   * Optional override for the template action delimiters. Mirrors
   * Go's `text/template.Template.Delims(left, right)`. Both sides
   * are required if specified — neither may be empty.
   *
   * [LAW:single-enforcer] Validated once at construct time and
   * threaded into the parser as immutable data; no re-validation
   * along the call chain.
   * [LAW:dataflow-not-control-flow] The delim pair is data flowing
   * into the fixed lexer state machine — no new modes, no new
   * branches, just different constant values seeded at construction.
   */
  readonly delims?: Delims;
  /** Optional registry of named functions usable in pipelines. */
  readonly funcs?: FuncMap;
}

// Per-evaluate context. Threaded through every internal method.
interface EvalContext<T> {
  readonly out: T[];
  readonly defines: ReadonlyMap<string, ListNode>;
  readonly source: string | undefined;
}

// [LAW:types-are-the-program] Internal control-flow sentinels for
// `{{break}}` / `{{continue}}`. They are NOT user-facing errors —
// `TemplateError` deliberately is not their base — and they never
// escape `evalRange`: the parser guarantees (via rangeDepth) that
// every Break/Continue node is lexically inside a Range body, and
// the range body is the only thrower-and-catcher of these. A
// reference-identity check at the catch site is the strongest
// possible discriminator: no string matching, no error-message
// drift, no risk of swallowing user errors. See [LAW:single-enforcer]
// — these constants are the one source of truth for the signal.
const BREAK_SIGNAL = Object.freeze({ kind: "break" as const });
const CONTINUE_SIGNAL = Object.freeze({ kind: "continue" as const });

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
  // [LAW:single-enforcer] One field, consulted only at `resolveFieldChain`.
  // [LAW:one-source-of-truth] Default is `"default"` so the engine
  // matches Go's `text/template` default ("missingkey=default" /
  // "invalid"). The conformance corpus is generated by Go's reference
  // implementation under that default; aligning the JS default keeps
  // byte-parity for any fixture exercising missing keys.
  private readonly missingKey: MissingKeyOption;
  // [LAW:single-enforcer] One field, threaded into the parser as
  // immutable data. `undefined` means "use parser's defaults" — we
  // never store a synthesized default here, so the engine can't
  // accidentally diverge from whatever the parser considers default.
  private readonly delims: Delims | undefined;

  constructor(config: EngineConfig<T>) {
    this.fromString = config.fromString;
    // `toString` collides with `Object.prototype.toString`, so a plain
    // `config.toString ?? default` would silently bind the prototype
    // method when the consumer didn't pass anything. Check for an own
    // property explicitly so the fallback only fires for unconfigured
    // engines.
    const userToString = Object.hasOwn(config, "toString") ? config.toString : undefined;
    this.toString = (userToString ?? defaultToString) as (value: unknown) => string;
    // [LAW:no-defensive-null-guards] exception: trust boundary — the
    // EngineConfig flows in from JS callers (no compile-time guard) and
    // TS callers using `as` casts. A typo like `"erro"` would silently
    // degrade to default semantics and disable the strict policy a
    // caller asked for. Validate at construct time so the bad value
    // fails loud at the only place it can be detected.
    this.missingKey = validateMissingKey(config.missingKey);
    // [LAW:no-defensive-null-guards] exception: trust boundary. Same
    // rationale as `missingKey`: a typo'd or partially-set delims
    // object from a JS caller would otherwise produce baffling
    // tokenization at parse time. Fail loud at the only place the
    // mistake can be detected.
    this.delims = validateDelims(config.delims);
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
    const parsed = parseSource(source, this.delims);
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
      case "Break":
        // [LAW:single-enforcer] The signal is the *only* mechanism;
        // the parser already guarantees we're lexically inside a
        // range, and `evalRange` is the only catcher.
        throw BREAK_SIGNAL;
      case "Continue":
        throw CONTINUE_SIGNAL;
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
    // [LAW:single-enforcer] Two catch boundaries, exactly mirroring
    // Go's text/template `walkRange` (exec.go: two `defer recover`s
    // around the function and around `oneIteration`):
    //
    //   - The *outer* try catches BREAK_SIGNAL only. It scopes both
    //     the body-iteration loop *and* the `else` clause — so a
    //     break inside a range's else (legal only when there is an
    //     outer range, by the parser's `rangeDepth` rule) terminates
    //     this range, not the outer one.
    //
    //   - The *inner* per-iteration try catches CONTINUE_SIGNAL only.
    //     Continue inside the body advances to the next iteration;
    //     continue inside the else propagates up, because the outer
    //     try doesn't catch it (matches Go: walkContinue is not
    //     caught by walkRange's outer recover).
    //
    // Reference-identity catches — no message-string matching, so
    // unrelated user errors with similar shapes are never swallowed.
    try {
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
        try {
          this.evalList(node.list, child, ctx);
        } catch (e) {
          if (e === CONTINUE_SIGNAL) continue;
          throw e;
        }
      }
    } catch (e) {
      if (e === BREAK_SIGNAL) return;
      throw e;
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
    // funcs declare permissive slots (e.g. `"truthy"`) so the
    // validation is a no-op against thunks.
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
      this.fromString as (s: string) => unknown,
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
      if (e instanceof FailError) {
        throw new FailError(e.message, cmd.pos, { source: ctx.source });
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
          this.fromString as (s: string) => unknown,
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
    if (result !== MISSING) return result;
    // [LAW:dataflow-not-control-flow] Single gate, three productions.
    // The policy value (a discriminator already validated by the
    // EngineConfig type) drives which production runs — no checks
    // scattered across accessors. `"default"` and `"zero"` collapse to
    // the same JS-observable behavior because JS lacks the static
    // value-type info Go's `reflect.New(elemType).Elem()` consumes; the
    // option is accepted for API parity (see MissingKeyOption JSDoc).
    if (this.missingKey === "error") {
      throw new MissingFieldError(idents, pos, { source: ctx.source });
    }
    return undefined;
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
  values: unknown[],
  pos: Pos,
  src: string | undefined,
  toString: (value: unknown) => string = defaultToString,
  pattern?: "alternating",
  fromString: (s: string) => unknown = defaultFromString,
): void {
  // [LAW:dataflow-not-control-flow] No short-circuit. The shape of work
  // is fixed: validate every positional value against its declared
  // type. Variability lives in `argTypes` (use intent-named kinds like
  // `"value"` for genuinely heterogeneous slots), never in whether
  // validation runs.
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
    // [LAW:single-enforcer] The lift lives at the gate, never in func
    // bodies — bodies of "liftable" slots see T, full stop. Mirrors the
    // T→string direction owned by `engine.toString` (used by
    // `"stringifiable"`); this is the string→T direction owned by
    // `engine.fromString`. Probe-only matchers stay pure; this gate
    // mutation is the one place a typed boundary actually rewrites.
    if (declared === "liftable" && typeof value === "string") {
      values[i] = fromString(value);
    }
    // [LAW:single-enforcer] Numeric carrier normalization lives at the
    // gate so bodies receive `number`, never `number | bigint`. Mirrors
    // the "liftable" lift above: matcher proves membership, gate
    // mutates to the canonical carrier. Bodies of "int"/"float" slots
    // can rely on `typeof value === "number"`. Added by epic
    // template-variance-num-carrier-hfv.1; consumers migrated in .2/.3;
    // the transitional "number" kind was retired in .4 so this gate is
    // the only normalization site.
    if (declared === "int") {
      values[i] = Math.trunc(Number(value));
    } else if (declared === "float") {
      values[i] = Number(value);
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
    // is itself a registration bug — fall back to "value" so the loop
    // does not throw on a stale zero-arity registration.
    return () => "value";
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
    case "truthy":
    case "reflective":
    case "value":
      // [LAW:dataflow-not-control-flow] Permissive matcher; the
      // *label* carries reader-facing intent so a future grep can
      // distinguish "we accept anything because we inspect the type"
      // from "we accept anything because we run truthiness"
      // from "any escape-hatch leftover". Migration target for .8.
      return true;
    case "string":
      return typeof value === "string";
    case "int":
      // [LAW:types-are-the-program] Strongest true theorem for an "int"
      // slot: the value is a finite integer-valued carrier. The matcher
      // is what makes this a theorem the body can assume, not a comment
      // it has to defend with re-checks. NaN and Infinity have no
      // integer interpretation (`Math.trunc(NaN) === NaN`); bigints
      // outside `Number.MAX_SAFE_INTEGER` lose precision under
      // `Number()` and would silently propagate corrupted values.
      return (
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "bigint" && Number.isSafeInteger(Number(value)))
      );
    case "float":
      // [LAW:types-are-the-program] "float" mirrors IEEE 754: NaN and
      // ±Infinity are legitimate float values (Go's float64 has them
      // too), so the matcher accepts them — they survive gate
      // normalization unchanged. The only rejected bigint shape is one
      // whose `Number()` conversion overflows to Infinity, because
      // that's a magnitude failure, not a float-precision tradeoff.
      // Bigints in the merely-precision-losing range (e.g. 2n**100n)
      // are accepted; float never promised exact preservation.
      return (
        typeof value === "number" || (typeof value === "bigint" && Number.isFinite(Number(value)))
      );
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
    case "sliceable":
      // Receiver shape for `slice`: string or array. Maps/dicts/Sets
      // are not sliceable in Go's `text/template`.
      return typeof value === "string" || Array.isArray(value);
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
    case "liftable":
      // Mirror of "stringifiable" in the opposite direction: a slot
      // that accepts T or a string the engine can lift to T via
      // `engine.fromString`. The matcher only validates membership;
      // the actual lift happens once in `enforceArgTypes` so func
      // bodies see T uniformly. Non-string non-T values fail the
      // gate — the same shape rules as "T".
      return (
        typeof value === "string" ||
        (value !== null &&
          value !== undefined &&
          typeof value !== "number" &&
          typeof value !== "boolean" &&
          typeof value !== "bigint" &&
          typeof value !== "symbol")
      );
    case "serializable":
      // Runtime-validate JSON encodability. `JSON.stringify` returns
      // `undefined` for functions/symbols and throws on circular refs;
      // either result fails the gate.
      return isJsonSerializable(value);
    default: {
      // [LAW:types-are-the-program] Explicit exhaustiveness check.
      // The `never` assignment is what makes adding a future ArgType
      // — or, equivalently, reintroducing the retired `"number"` —
      // a tsc error: a fresh union member is no longer assignable to
      // `never`, so the editor sees the missed case at compile time.
      // The `throw` covers the only escape from the type system —
      // callers that cast past `ArgType` at runtime (e.g. a stale
      // `argTypes: ["number" as ArgType]` registration) get a clear
      // "invalid ArgType" diagnostic instead of a silent `undefined`-
      // returning matcher that would surface later as a confusing
      // "expected undefined" TypeMismatchError.
      const _exhaustive: never = declared;
      throw new Error(`invalid ArgType: ${String(_exhaustive)}`);
    }
  }
}

// Default lifter, used only when `enforceArgTypes` is called outside
// the engine's dispatch path (e.g. tests exercising the gate
// directly). Real engine calls always thread `this.fromString` from
// `EngineConfig`, which is mandatory in the public API. Identity
// keeps the gate honest in the synthetic case: a string literally
// flows through unchanged, so `T = string` engines never need to
// know about `"liftable"` for the gate to behave correctly.
function defaultFromString(s: string): unknown {
  return s;
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
    case "int":
      return "integer (finite number or safe-integer bigint)";
    case "float":
      return "float (number, including NaN/Infinity, or finite-convertible bigint)";
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
    case "liftable":
      return "liftable value (T or string, the latter lifted via the engine's fromString)";
    case "callable":
      return "callable (function value)";
    case "collection":
      return "collection (string, array, Map, or dict)";
    case "index-key":
      return "index key (number, bigint, or string)";
    case "sliceable":
      return "sliceable value (string or array)";
    case "serializable":
      return "JSON-serializable value";
    case "truthy":
    case "reflective":
    case "value":
    case "string":
    case "bool":
      return t;
    default: {
      // [LAW:types-are-the-program] Same explicit exhaustiveness arm
      // as `matchesArgType` — see the rationale there. Mirrors it
      // here so the retirement-of-"number" guardrail is symmetric:
      // both the gate's membership predicate and its human-readable
      // labeller refuse to silently handle an unknown kind.
      const _exhaustive: never = t;
      throw new Error(`invalid ArgType: ${String(_exhaustive)}`);
    }
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
