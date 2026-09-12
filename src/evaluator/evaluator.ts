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
  type ArgCount,
  ArgCountError,
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
import {
  type Defines,
  lookupDefine,
  type ParseResult,
  parse as parseSource,
} from "../parser/parser.js";
import type { Pos } from "../parser/pos.js";
import { walk } from "../parser/walk.js";
import { MISSING, walkFieldChain } from "./access.js";
import { defaultBuiltins, formatV, type IsT, isPlainObject } from "./builtins.js";
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
 * - "T"      — a T: membership is exactly the engine's `isT` (see
 *   `EngineConfig.isT`).
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

/**
 * How many arguments a func accepts, and how `argTypes` covers them.
 *
 * [LAW:types-are-the-program] Argument *count* used to live only in the
 * JS signature, where the gate could not see it: `enforceArgTypes`
 * iterated the supplied values, so a missing or surplus argument was
 * not a state it could represent, let alone reject. Declaring arity
 * alongside `argTypes` makes the count a fact the gate reads —
 * `acceptedArgCount` projects this union into the counts a declaration
 * admits and rejects the rest before the slot loop.
 *
 * [LAW:one-source-of-truth] No kind carries a count that `argTypes`
 * already holds. `"exact"` means exactly `argTypes.length`, and
 * `"variadic"` means at least `argTypes.length - 1` — which is Go's
 * gate for a variadic signature, always, since its fixed parameters are
 * every one but the last. A `minimum` field on either would be a second
 * copy of a number the array carries, and the copy is what drifts:
 * `minimum` survives here only on `"alternating"`, where `argTypes` is
 * a cycle length rather than a parameter count and the two are
 * genuinely unrelated.
 *
 * [LAW:one-type-per-behavior] The three kinds are exactly the three
 * slot-lookup rules, so `makeSlotLookup` switches on this union and
 * nothing else. Folding the former `argTypePattern` field in here is
 * what makes "exact yet alternating" unrepresentable rather than merely
 * unused.
 *
 * There is deliberately no `between`/optional-trailing kind: Go's own
 * `text/template` and `sprig` have no notion of an optional parameter,
 * so every signature is fixed-arity or variadic. That every declaration
 * here matches the Go function it mirrors is not a claim — it is
 * checked by `go-arity.test.ts` against `go-arity.fixture.json`, which
 * `conformance/gen/arity` extracts from Go. Do not add a fourth kind
 * without a Go signature that demands it.
 */
export type Arity =
  /** Exactly `argTypes.length` arguments; each slot is declared once. */
  | { readonly kind: "exact" }
  /**
   * At least `argTypes.length - 1` arguments — Go's own gate for a
   * variadic signature, whose fixed parameters are every one but the
   * last. The trailing `argTypes` entry is that last, repeating
   * parameter, so every argument past the declared ones validates
   * against `argTypes[argTypes.length - 1]`.
   *
   * Declare one slot per Go parameter, the repeating one last: `eq` is
   * `func(reflect.Value, ...reflect.Value)`, so it declares two
   * `"comparable"` slots and requires one. Collapsing those to a single
   * slot would render the same verdicts today and quietly lose the
   * minimum.
   */
  | { readonly kind: "variadic" }
  /**
   * At least `minimum` arguments — the one kind that needs the number,
   * because `argTypes` below is a cycle length, not a parameter count.
   * With `argTypes` read as a *cycle*:
   * the slot for argument `i` is `argTypes[i % argTypes.length]`. Used
   * by `dict`'s `string, value, string, value, …` kv pairing — without
   * it the gate cannot distinguish even-index keys (must be string)
   * from odd-index values (anything), and the body would re-validate
   * per key, splitting `[LAW:single-enforcer]` across two layers.
   */
  | { readonly kind: "alternating"; readonly minimum: number };

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
   *
   * The signature is *not* a source of arity: `fn.length` stops at the
   * first rest parameter and lies about several registrations (`min`,
   * `max`, `mul` and friends report 0 while Go requires 1). Arity comes
   * from `arity`, never from here.
   */
  readonly fn: (...args: never[]) => unknown;
  /**
   * Declared positional parameter types. Required.
   *
   * How the slots cover the supplied arguments is `arity`'s job: an
   * `"exact"` func declares one entry per parameter, a `"variadic"` one
   * declares the repeating slot last, and an `"alternating"` one
   * declares the cycle.
   *
   * The pipe-fed last argument is appended to the positional list
   * before validation, so it is checked against the slot its final
   * position selects.
   */
  readonly argTypes: readonly ArgType[];
  readonly returnType?: ArgType;
  /**
   * Argument count. Required — a func whose arity is undeclared is a
   * func the gate cannot check, and defaulting to a permissive value
   * would hide exactly the registrations that most need the
   * declaration.
   *
   * Minimums mirror Go's *arity gate*, which is not always the same as
   * the function body's own requirement; see `eq` and `dig`.
   */
  readonly arity: Arity;
}

export type FuncMap = Record<string, TemplateFunc>;

/**
 * Everything the argument gate reads off a registration.
 *
 * [LAW:types-are-the-program] `argTypes` and `arity` answer one
 * question between them — which arguments are legal — and neither
 * answers it alone: `argTypes` says what each slot holds, `arity` says
 * how many slots there are and how they cover the supplied values.
 * Passing them as one value is what makes "types without their arity"
 * unrepresentable at the gate; when they were two positional
 * parameters, the second one defaulted and the count check could be
 * skipped by omission.
 */
export type ArgSpec = Pick<TemplateFunc, "argTypes" | "arity">;

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

// [LAW:types-are-the-program] The strongest theorem the gate needs is
// that every registration's declared arity actually covers its declared
// slots. TypeScript carries most of it — `arity` is required, and the
// three kinds are a closed union — but not this last correlation: only
// `"exact"` may declare zero slots. `"variadic"` reads its repeating
// slot off the end of `argTypes`, so with none declared its minimum
// derives to -1 and the gate accepts any count; `"alternating"` indexes
// `i % argTypes.length`, so with none declared every slot lookup is
// NaN. Both silently disable the gate for that func rather than failing
// — [LAW:no-silent-failure] — which is why this is a construct-time
// error and not a permissive fallback.
//
// Expressing it in the type would mean splitting `TemplateFunc` into a
// union discriminated on `arity.kind`, with the variadic arm requiring
// a non-empty `argTypes` tuple. That correlation does not survive the
// `Pick` the gate takes (`ArgSpec`), so it would buy a compile-time
// check for registrations and lose one at the gate. This is the same
// JS-boundary mirror `validateMissingKey` and `validateDelims` are.
//
// The predicate is a returning switch rather than `kind !== "exact"` so
// that adding a fourth `Arity` kind fails to compile until someone says
// which side of this line it falls on.
function readsSlotsFromArgTypes(arity: Arity): boolean {
  switch (arity.kind) {
    case "exact":
      return false;
    case "variadic":
      return true;
    case "alternating":
      return true;
  }
}

function validateArities(funcs: FuncMap): FuncMap {
  for (const [name, fn] of Object.entries(funcs)) {
    if (readsSlotsFromArgTypes(fn.arity) && fn.argTypes.length === 0) {
      throw new Error(
        `EngineConfig.funcs.${name}: arity ${JSON.stringify(fn.arity.kind)} needs at ` +
          `least one declared argType (it reads its repeating slot from the end of ` +
          `argTypes); declare the slots the Go signature has, or use { kind: "exact" }`,
      );
    }
  }
  return funcs;
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
   * Is this value a T? At the output stream a T is pushed as itself and
   * anything else is printed as Go prints it (`[a b]`, `map[k:v …]`, a
   * Date's own String); at a call, a `"T"` ArgType slot accepts exactly
   * what this says.
   *
   * [LAW:single-enforcer] The one predicate, consulted first and alone.
   * Default: a non-null object other than an array or a Map — so without
   * it a consumer whose scope carries JSON documents sees a bare
   * `{{ .doc }}` leak the document into its fragments; with
   * `isT: (v) => v instanceof RichText` that `{{ .doc }}` prints
   * `map[k:v …]`, and a consumer whose T is array-shaped says so here.
   */
  readonly isT?: (value: unknown) => value is T;
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
  readonly defines: Defines;
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
let internalCreateTemplate: <U>(
  source: string,
  evaluate: (scope: unknown) => U[],
  defines: Defines,
  referencedFunctions: ReadonlySet<string>,
  referencedCalls: readonly ReferencedCall[],
) => Template<U>;

// [LAW:types-are-the-program] One command-head call site projected to the facts
// a static consumer can act on: the callee name and its positional arguments,
// with each LITERAL string argument decoded and every non-literal argument
// (field, pipeline, bool, number, …) reported as `null` so positions are
// preserved. This is the argument-aware companion to `referencedFunctions`:
// where that answers "is X called?", this answers "with what literal strings?".
export interface ReferencedCall {
  /** The function name at the head of the command. */
  readonly name: string;
  /**
   * The positional arguments after the head. A literal string argument is its
   * decoded value; any non-string-literal argument is `null` (its value is only
   * known at evaluation time). Indices match the call site, so `args[0]` is the
   * first argument regardless of the kinds in between.
   *
   * [LAW:one-source-of-truth] A derived view of {@link argExprs} — the
   * string-literal projection kept for consumers that only read literal
   * string slots. `args[i]` is `argExprs[i].value` when that is a literal
   * string, `null` otherwise.
   */
  readonly args: readonly (string | null)[];
  /**
   * The positional arguments after the head, each statically projected to a
   * {@link ReferencedArg}. Indices match the call site (`argExprs[0]` is the
   * first argument), and `argExprs.length === args.length`.
   */
  readonly argExprs: readonly ReferencedArg[];
}

/**
 * A scalar value statically decodable from a literal argument node. Numbers
 * carry the same JS value evaluation would produce (safe ints as `number`,
 * larger ints as `bigint`); `null` is the projection of the `nil` literal.
 */
export type ReferencedLiteral = string | number | bigint | boolean | null;

// [LAW:types-are-the-program] The total static projection of one call
// argument. Three shapes cover the whole grammar: a literal scalar whose
// value is known at parse time; a nested call `(f a b …)` projected
// recursively so a consumer can read e.g. `(dict "k" "v")` option args
// without evaluating; and `dynamic` for everything whose value only exists
// at eval time (fields, variables, pipelines, function-valued idents, …).
// A value is never guessed: anything not provably literal is `dynamic`
// [LAW:no-silent-failure].
export type ReferencedArg =
  | { readonly kind: "literal"; readonly value: ReferencedLiteral }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly ReferencedArg[] }
  | { readonly kind: "dynamic" };

export class Template<T> {
  readonly source: string;
  private readonly _evaluate: (scope: unknown) => T[];
  private readonly _defines: Defines;
  // [LAW:types-are-the-program] The set of FuncMap names this template
  // references, computed ONCE from the parsed AST at construction. A name here
  // is a function the template *can* call (it is the head of some command, or
  // appears as a function-valued argument); whether a given evaluation reaches
  // it is a runtime question this static fact does not answer. Frozen so the
  // exposed set cannot be mutated by a caller.
  private readonly _referencedFunctions: ReadonlySet<string>;
  // [LAW:types-are-the-program] Every command-head call with its literal string
  // args, computed ONCE from the same parsed AST. A superset of the information
  // in `_referencedFunctions` (every call's name is also a referenced function),
  // exposed separately so the cheaper name-only query stays a `Set`.
  private readonly _referencedCalls: readonly ReferencedCall[];

  private constructor(
    source: string,
    evaluate: (scope: unknown) => T[],
    defines: Defines,
    referencedFunctions: ReadonlySet<string>,
    referencedCalls: readonly ReferencedCall[],
  ) {
    this.source = source;
    this._evaluate = evaluate;
    this._defines = defines;
    this._referencedFunctions = referencedFunctions;
    this._referencedCalls = referencedCalls;
  }

  static {
    internalCreateTemplate = <U>(
      source: string,
      evaluate: (scope: unknown) => U[],
      defines: Defines,
      referencedFunctions: ReadonlySet<string>,
      referencedCalls: readonly ReferencedCall[],
    ) => new Template(source, evaluate, defines, referencedFunctions, referencedCalls);
  }

  /**
   * The named sub-templates this template can invoke — its own `{{define}}`s
   * chained onto whatever it inherited at parse. Pass it to `engine.parse` as
   * `inherit` to let another template invoke the same set without re-parsing
   * (and re-allocating) it: the idiom for a shared helper preamble is
   * `const helpers = engine.parse(preamble).defines()` once, then
   * `engine.parse(src, helpers)` per template. Opaque: the AST inside is not
   * part of the public surface.
   */
  defines(): Defines {
    return this._defines;
  }

  evaluate(scope: unknown): T[] {
    return this._evaluate(scope);
  }

  /**
   * The FuncMap function names this template references — every identifier that
   * names a function in this parse: the template body and its own `{{ define }}`
   * blocks. A set inherited at parse (see {@link Template.defines}) is described
   * by the template that parsed it, not here.
   *
   * This is a STATIC fact derived from the parsed AST, not an execution trace:
   * a name in the set is a function the template *can* invoke; a name absent
   * from the set is one it provably never invokes. Use it to ask "does this
   * template use helper X?" without evaluating it (e.g. to discover which
   * templates depend on a feature func) — robust where a source-text scan is
   * not, because it sees through whitespace, pipelines, and field/string
   * lookalikes.
   *
   * Built-in operators registered for every engine (`and`, `eq`, `index`,
   * `printf`, …) are reported the same as consumer funcs — a referenced name is
   * a referenced name regardless of who registered it.
   */
  referencedFunctions(): ReadonlySet<string> {
    return this._referencedFunctions;
  }

  /**
   * Every command-head call in this parse — the template body and its own
   * `{{ define }}` blocks, never an inherited set — in preorder, each paired with its positional arguments projected to literal
   * strings (a non-string-literal argument is reported as `null`, preserving
   * argument positions).
   *
   * Like {@link referencedFunctions} this is a STATIC fact from the parsed AST,
   * not an execution trace. Use it when "is X called?" is not enough and you
   * need the literal arguments a call was written with — e.g. to discover that a
   * template contains `{{ menu "applyTheme" "themePage" }}` and read its first
   * argument without evaluating the template. Each call's `argExprs` carries the
   * full {@link ReferencedArg} projection (scalar literals, nested literal calls
   * like `(dict "k" "v")`, `dynamic` for eval-time values); `args` is its
   * string-literal-only view. Calls whose head is not a bare function
   * identifier (e.g. a field invoked via `call`) are not reported here; their
   * names still appear in {@link referencedFunctions}.
   */
  referencedCalls(): readonly ReferencedCall[] {
    return this._referencedCalls;
  }
}

// [LAW:single-enforcer] The one place "which functions does this AST reference"
// is computed — a single preorder walk (the shared traversal helper) over the
// root body and every `{{ define }}` body. In go-template's grammar every
// IdentifierNode names a function (bare `true`/`nil`/numbers parse to their own
// node kinds), whether it is a command head (`{{ f x }}`) or a function-valued
// argument (`{{ call .x f }}`), so collecting every Identifier is exactly the
// set of referenced functions — no positional special-casing.
function collectReferencedFunctions(parsed: ParseResult): ReadonlySet<string> {
  const names = new Set<string>();
  const collect = (root: Node): void => {
    walk(root, (node) => {
      if (node.type === "Identifier") names.add(node.ident);
    });
  };
  collect(parsed.root);
  for (const entry of parsed.ownDefines.values()) collect(entry.list);
  return names;
}

const DYNAMIC_ARG: ReferencedArg = { kind: "dynamic" };

// [LAW:single-enforcer] The one place an argument node becomes a
// ReferencedArg. Literal leaves decode to the SAME JS value evaluation
// produces — strings/bools directly, numbers via the shared `numberValue`
// (complex literals have no scalar carrier, so they stay `dynamic` rather
// than invent one), `nil` as `null`. A parenthesised argument parses as a
// PipeNode; only the trivial pipe — no declarations, exactly one command,
// an Identifier head — is a statically readable nested call `(f a b …)`,
// projected recursively. Every other shape is an eval-time value: `dynamic`.
function projectArg(node: Node): ReferencedArg {
  switch (node.type) {
    case "String":
      return { kind: "literal", value: node.value };
    case "Bool":
      return { kind: "literal", value: node.value };
    case "Nil":
      return { kind: "literal", value: null };
    case "Number": {
      const value = numberValue(node);
      return typeof value === "number" || typeof value === "bigint"
        ? { kind: "literal", value }
        : DYNAMIC_ARG;
    }
    case "Pipe": {
      if (node.decls.length !== 0 || node.cmds.length !== 1) return DYNAMIC_ARG;
      const cmd = node.cmds[0];
      if (cmd === undefined) return DYNAMIC_ARG;
      const head = cmd.args[0];
      if (head === undefined || head.type !== "Identifier") return DYNAMIC_ARG;
      return { kind: "call", name: head.ident, args: cmd.args.slice(1).map(projectArg) };
    }
    default:
      return DYNAMIC_ARG;
  }
}

// [LAW:single-enforcer] The one place "which command-head calls, with what
// literal args" is computed — the same preorder walk as
// `collectReferencedFunctions`, over the root body and every `{{ define }}`. A
// CommandNode whose first arg is an Identifier is a call of that function; the
// remaining args are projected via `projectArg`, preserving positions, and the
// legacy string-only `args` view is derived from that projection
// [LAW:one-source-of-truth]. Pipeline stages (`{{ x | f }}`) parse as Commands
// too, so `f` is reported with the args written at its own stage (the piped
// value is prepended at eval and is not an AST argument) — consistent with how
// the head/args split is defined here.
function collectReferencedCalls(parsed: ParseResult): readonly ReferencedCall[] {
  const calls: ReferencedCall[] = [];
  const collect = (root: Node): void => {
    walk(root, (node) => {
      if (node.type !== "Command") return;
      const head = node.args[0];
      if (head === undefined || head.type !== "Identifier") return;
      const argExprs = node.args.slice(1).map(projectArg);
      calls.push({
        name: head.ident,
        args: argExprs.map((arg) =>
          arg.kind === "literal" && typeof arg.value === "string" ? arg.value : null,
        ),
        argExprs,
      });
    });
  };
  collect(parsed.root);
  for (const entry of parsed.ownDefines.values()) collect(entry.list);
  return calls;
}

export class Engine<T> {
  private readonly fromString: (s: string) => T;
  // [LAW:single-enforcer] Stored alongside `fromString` so the engine
  // owns both halves of the text↔T boundary. Threaded into
  // `enforceArgTypes` so `"stringifiable"` slots probe with the same
  // function that downstream func bodies will re-use to flatten.
  private readonly toString: (value: unknown) => string;
  private readonly isT: IsT;
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
    this.isT = config.isT ?? DEFAULT_IS_T;
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
    //
    // [LAW:parse-dont-validate] Arity well-formedness is checked once,
    // here, on the merged map — after overrides, so a consumer cannot
    // shadow a built-in with a malformed declaration. The gate then
    // derives counts from these declarations without re-checking them.
    this.funcs = validateArities({
      ...defaultBuiltins(this.toString, this.isT),
      ...(config.funcs ?? {}),
    });
  }

  /**
   * Parse a template source into a reusable Template handle.
   *
   * The returned Template is immutable; calling `evaluate(scope)` on
   * it any number of times with different scopes is safe and avoids
   * re-parsing.
   */
  parse(source: string, inherit?: Defines): Template<T> {
    const parsed = parseSource(source, this.delims, inherit);
    return internalCreateTemplate(
      parsed.source,
      (scope) => this.evalParsed(parsed, scope),
      parsed.defines,
      collectReferencedFunctions(parsed),
      collectReferencedCalls(parsed),
    );
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
    const entry = lookupDefine(ctx.defines, node.name);
    if (!entry) {
      throw new EvalError(`template ${JSON.stringify(node.name)} is not defined`, node.pos, {
        source: ctx.source,
      });
    }
    const arg = node.pipe ? this.evalPipe(node.pipe, scope, ctx) : scope.dot;
    const child = pushScope(scope, arg);
    // The body's errors snippet against the source that declared it, which
    // for an inherited define is not this template's source.
    this.evalList(entry.list, child, { out: ctx.out, defines: ctx.defines, source: entry.source });
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
    const entry = lookupDefine(ctx.defines, node.name) ?? { list: node.list, source: ctx.source };
    this.evalList(entry.list, child, { out: ctx.out, defines: ctx.defines, source: entry.source });
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
      fn,
      args,
      cmd.pos,
      ctx.source,
      this.toString,
      this.fromString as (s: string) => unknown,
      this.isT,
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
          fn,
          [],
          node.pos,
          ctx.source,
          this.toString,
          this.fromString as (s: string) => unknown,
          this.isT,
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
    // A T is pushed as itself; anything else prints as Go's
    // `fmt.Sprintf("%v", v)` would (`[a b c]`, `map[k:v]`), which keeps the
    // conformance corpus byte-equal.
    if (this.isT(value)) {
      ctx.out.push(value as T);
      return;
    }
    ctx.out.push(this.fromString(formatV(value, this.toString, this.isT)));
  }
}

// [LAW:one-source-of-truth] The engine's default `isT`, shared by the
// constructor and the standalone `enforceArgTypes`, so the output stream and
// the `"T"` ArgType gate cannot disagree about what a T is by default.
export const DEFAULT_IS_T: IsT = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Map);

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
  spec: ArgSpec,
  values: unknown[],
  pos: Pos,
  src: string | undefined,
  toString: (value: unknown) => string = defaultToString,
  fromString: (s: string) => unknown = defaultFromString,
  isT: IsT = DEFAULT_IS_T,
): void {
  const { argTypes, arity } = spec;
  // [LAW:parse-dont-validate] The count check is the first leg of this
  // checkpoint and it fails loudly: a call whose argument count the
  // declared arity does not accept never reaches the slot loop, and
  // never reaches the body. Everything below this line — and every
  // func body downstream of it — may assume `values.length` is one the
  // signature admits, so nothing inland counts arguments again.
  //
  // It runs *before* the slot loop deliberately. Too few arguments
  // shifts the remaining ones into the wrong slots, so checking types
  // first reports a missing argument as a type error: `substr "a"`
  // used to complain that a string flowed into an integer slot, which
  // is confidently wrong about which mistake the author made.
  const accepted = acceptedArgCount(argTypes, arity);
  if (values.length < accepted.minimum || values.length > accepted.maximum) {
    throw new ArgCountError(funcName, accepted, values.length, pos, { source: src });
  }
  // [LAW:dataflow-not-control-flow] No short-circuit. The shape of work
  // is fixed: validate every positional value against its declared
  // type. Variability lives in `argTypes` (use intent-named kinds like
  // `"value"` for genuinely heterogeneous slots), never in whether
  // validation runs.
  //
  // [LAW:single-enforcer] Slot lookup is a single function — the
  // variadic-overflow rule (trailing-repeat, modulo cycle when the
  // arity is `"alternating"`) lives here once, not duplicated at the
  // loop body. See template-laws-3gt.3 for the alternation motivation
  // (`dict`'s string/value kv pairing).
  const lookup = makeSlotLookup(argTypes, arity);
  let firstOrdered = -1;
  let firstComparable = -1;
  for (let i = 0; i < values.length; i++) {
    const declared = lookup(i);
    const value = values[i];
    if (!matchesArgType(declared, value, toString, isT)) {
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

// The counts a declaration accepts. Sibling projection to
// `makeSlotLookup` below: both read the same `Arity` union, this one
// for how many arguments are legal, that one for what each is. Neither
// duplicates the other's rule.
//
// [LAW:one-source-of-truth] Every number here is derived. `"exact"`
// accepts exactly as many arguments as it declares slots; `"variadic"`
// requires all but the repeating one, which is Go's own gate for a
// variadic signature; only `"alternating"` supplies a number, because
// there `argTypes` is a cycle length and carries no count. Storing a
// minimum on the other two kinds would be a second copy of
// `argTypes.length`, and the copy is what drifts.
//
// No `Math.max(0, …)` floor is needed for the `"variadic"` subtraction:
// a variadic registration declaring no slots is rejected at construct
// time by `validateArities`, so `argTypes.length` is at least 1 here.
function acceptedArgCount(argTypes: readonly ArgType[], arity: Arity): ArgCount {
  switch (arity.kind) {
    case "exact":
      return { minimum: argTypes.length, maximum: argTypes.length };
    case "variadic":
      return { minimum: argTypes.length - 1, maximum: Infinity };
    case "alternating":
      return { minimum: arity.minimum, maximum: Infinity };
  }
}

// [LAW:dataflow-not-control-flow] The variadic-overflow rule is encoded
// as a function that maps an arg index to its declared kind, picked
// once per call. The loop in `enforceArgTypes` then has the same shape
// for every func — no per-iteration `if (pattern === "alternating")`.
function makeSlotLookup(argTypes: readonly ArgType[], arity: Arity): (i: number) => ArgType {
  if (argTypes.length === 0) {
    // Funcs registered with `argTypes: []` are zero-arity at the gate.
    // The loop only runs when `values.length > argTypes.length`, which
    // is itself a registration bug — fall back to "value" so the loop
    // does not throw on a stale zero-arity registration.
    return () => "value";
  }
  if (arity.kind === "alternating") {
    const len = argTypes.length;
    return (i) => argTypes[i % len] as ArgType;
  }
  // Both remaining kinds read the trailing slot for overflow. For
  // `"variadic"` that is the rule.
  //
  // [LAW:polishing-by-subtraction] exception: kept until .2fc. For
  // `"exact"` the repeat is now unreachable — template-arity-n2j.49n
  // made `acceptedArgCount` reject an overflowing call before the loop
  // that consumes this lookup can run — and deleting the dead half is
  // template-arity-n2j.2fc's job, not a drive-by here.
  const trailing = argTypes[argTypes.length - 1] as ArgType;
  return (i) => (i < argTypes.length ? (argTypes[i] as ArgType) : trailing);
}

function matchesArgType(
  declared: ArgType,
  value: unknown,
  toString: (value: unknown) => string,
  isT: IsT,
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
      // [LAW:single-enforcer] What the engine's output stream calls a T.
      return isT(value);
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
      // Mirror of "stringifiable" in the opposite direction: a T, or a
      // string `enforceArgTypes` lifts once through `engine.fromString`.
      // [LAW:single-enforcer] The T half is the same predicate the "T" slot reads.
      return typeof value === "string" || isT(value);
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
