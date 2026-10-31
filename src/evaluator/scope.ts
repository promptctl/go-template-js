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

import { type Marks, NO_MARKS } from "./marks.js";

/**
 * A bound value and the marks it depends on.
 *
 * [LAW:types-are-the-program] One record, so no binding can be made
 * without saying what it depends on: a variable or a dot that forgot
 * its marks would report them late, which is the one failure
 * provenance exists to rule out.
 */
export interface Binding {
  readonly value: unknown;
  readonly marks: Marks;
}

export interface Scope {
  /** Current dot value — what `.` resolves to. */
  readonly dot: Binding;
  /** Top-level scope value — what `$` resolves to. */
  readonly root: unknown;
  /** Parent scope, or undefined for the top-level. */
  readonly parent: Scope | undefined;
  /** Variables declared in *this* frame. */
  readonly vars: Map<string, Binding>;
}

export function rootScope(value: unknown): Scope {
  return { dot: { value, marks: NO_MARKS }, root: value, parent: undefined, vars: new Map() };
}

export function pushScope(parent: Scope, dot: Binding): Scope {
  return { dot, root: parent.root, parent, vars: new Map() };
}

/**
 * Look up a `$var` binding, walking the parent chain.
 * Returns the binding on hit and `undefined` on miss — a `Binding` is a
 * record, so a variable declared as `undefined` is still a hit.
 */
export function lookupVar(scope: Scope, name: string): Binding | undefined {
  let cur: Scope | undefined = scope;
  while (cur !== undefined) {
    const binding = cur.vars.get(name);
    if (binding !== undefined) return binding;
    cur = cur.parent;
  }
  return undefined;
}

/** Declare a new variable in the leaf scope (for `:=`). */
export function declareVar(scope: Scope, name: string, binding: Binding): void {
  scope.vars.set(name, binding);
}
