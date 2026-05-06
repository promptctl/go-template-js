/**
 * Lexical scope chain for the evaluator.
 *
 * [LAW:dataflow-not-control-flow] A `Scope` is an immutable record of
 * `dot`, `root` (the original `$`), and a parent pointer. New frames
 * are *constructed*; we never mutate an existing frame to "leave" it.
 * That means iterations of `{{range}}` cannot see each other's `$var`
 * declarations — the data shape itself prevents the bug.
 *
 * Variables are stored on the leaf frame as a flat record. A lookup
 * walks the parent chain. Assignment via `=` searches the chain and
 * mutates the *binding's* frame; declaration via `:=` always creates
 * the binding in the current leaf frame.
 */

export interface Scope {
  /** Current dot value — what `.` resolves to. */
  readonly dot: unknown;
  /** Top-level scope value — what `$` resolves to. */
  readonly root: unknown;
  /** Parent scope, or undefined for the top-level. */
  readonly parent: Scope | undefined;
  /** Variables declared in *this* frame. */
  readonly vars: Map<string, unknown>;
}

export function rootScope(value: unknown): Scope {
  return { dot: value, root: value, parent: undefined, vars: new Map() };
}

export function pushScope(parent: Scope, dot: unknown): Scope {
  return { dot, root: parent.root, parent, vars: new Map() };
}

/**
 * Look up a `$var` binding, walking the parent chain.
 * Returns `{ found: true, value }` on hit and `{ found: false }` on miss
 * — explicit shape rather than `undefined` so callers can disambiguate
 * "not declared" from "declared but undefined".
 */
export function lookupVar(
  scope: Scope,
  name: string,
): { found: true; value: unknown } | { found: false } {
  let cur: Scope | undefined = scope;
  while (cur !== undefined) {
    if (cur.vars.has(name)) return { found: true, value: cur.vars.get(name) };
    cur = cur.parent;
  }
  return { found: false };
}

/** Declare a new variable in the leaf scope (for `:=`). */
export function declareVar(scope: Scope, name: string, value: unknown): void {
  scope.vars.set(name, value);
}

/**
 * Reassign an existing variable (for `=`). Walks the chain to find the
 * declaring frame and mutates its binding map. Throws via the caller's
 * supplied `notFound` factory when the variable was never declared.
 */
export function assignVar(scope: Scope, name: string, value: unknown): boolean {
  let cur: Scope | undefined = scope;
  while (cur !== undefined) {
    if (cur.vars.has(name)) {
      cur.vars.set(name, value);
      return true;
    }
    cur = cur.parent;
  }
  return false;
}
