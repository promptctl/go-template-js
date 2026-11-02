/**
 * `include` — Helm's function for rendering a `{{ define }}` by name and
 * returning its text, so a sub-template's output can be piped, tested,
 * defaulted or bound like any other value. `{{ template }}` renders the same
 * define but writes straight to the output, where none of that can reach it.
 *
 * Opt-in: Go's `text/template` has no `include`, so it is not a builtin.
 * Register it like a sprig group — `funcs: { ...sprigStrings(), include }` —
 * under any name.
 *
 * [LAW:single-enforcer] Rendering a define needs the evaluator's context,
 * which no `TemplateFunc` body receives. The evaluator recognizes `include`
 * by its module-private `fn` and runs the render in its place. A consumer
 * cannot forge that function, and it follows the registration through any
 * name and any copy (`{ ...include }`).
 *
 * Leaf module so `evaluator.ts` and `index.ts` import it without a cycle.
 */

import type { TemplateFunc } from "./evaluator.js";

// Never called: the evaluator dispatches on this reference to its own
// render. Reaching this body means that dispatch was bypassed.
const render = (): never => {
  throw new Error("include was called outside the evaluator's dispatch");
};

/** Helm's `include(name string, data interface{}) (string, error)`. */
export const include: TemplateFunc = {
  fn: render,
  argTypes: ["string", "value"],
  arity: { kind: "exact" },
  returnType: "string",
};

/** True iff `fn` is `include`, under whatever name or copy it was registered. */
export function isInclude(fn: TemplateFunc): boolean {
  return fn.fn === render;
}
