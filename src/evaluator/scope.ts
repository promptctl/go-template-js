/**
 * Lexical scope chain for the evaluator.
 *
 * [LAW:dataflow-not-control-flow] A `Scope` is a `dot`, a parent
 * pointer and the variables declared in it. Entering a construct or an
 * iteration *constructs* a frame and leaving it drops the frame, so
 * nothing is ever undone: iterations of `{{range}}` cannot see each
 * other's `:=` declarations — the data shape itself prevents the bug.
 *
 * Only a frame's variables change. A lookup walks the parent chain.
 * Assignment via `=` searches the chain and overwrites the binding in
 * the frame that declared it; declaration via `:=` always creates the
 * binding in the current leaf frame.
 *
 * `$` is an ordinary variable declared in a chain's root frame, as in
 * Go, where it is `vars[0]`: so `$ = v` assigns it, and a `template` /
 * `block` invocation starts a fresh chain whose only variable is `$`.
 */

import { type Marks, unionMarks } from "./marks.js";

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
  /** Parent scope, or undefined for a chain's root frame. */
  readonly parent: Scope | undefined;
  /** Variables declared in *this* frame. */
  readonly vars: Map<string, Binding>;
}

/** The frame a template body starts in: `.` and `$` are both `dot`. */
export function rootScope(dot: Binding): Scope {
  return { dot, parent: undefined, vars: new Map([["$", dot]]) };
}

export function pushScope(parent: Scope, dot: Binding): Scope {
  return { dot, parent, vars: new Map() };
}

// [LAW:single-enforcer] The one walk that decides which frame a name
// resolves to, so a read and an assignment can never disagree.
function findFrame(scope: Scope, name: string): Scope | undefined {
  let cur: Scope | undefined = scope;
  while (cur !== undefined && !cur.vars.has(name)) cur = cur.parent;
  return cur;
}

/**
 * Look up a `$var` binding, walking the parent chain.
 * Returns the binding on hit and `undefined` on miss — a `Binding` is a
 * record, so a variable declared as `undefined` is still a hit.
 */
export function lookupVar(scope: Scope, name: string): Binding | undefined {
  return findFrame(scope, name)?.vars.get(name);
}

/** Declare a new variable in the leaf scope (for `:=`). */
export function declareVar(scope: Scope, name: string, binding: Binding): void {
  scope.vars.set(name, binding);
}

/**
 * Overwrite the nearest frame's binding of `name` (for `=`), as Go's
 * text/template exec.go walks its variable stack. Returns whether any
 * frame declared it; the caller owns the "undefined variable" error,
 * which needs a position this module does not have.
 */
export function assignVar(scope: Scope, name: string, binding: Binding): boolean {
  const frame = findFrame(scope, name);
  frame?.vars.set(name, binding);
  return frame !== undefined;
}

/** Add `marks` to what `name`'s binding depends on, if any frame declared it. */
export function markVar(scope: Scope, name: string, marks: Marks): void {
  const binding = lookupVar(scope, name);
  if (binding === undefined) return;
  assignVar(scope, name, { value: binding.value, marks: unionMarks(binding.marks, marks) });
}
