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
 * which no `TemplateFunc` body receives. The evaluator recognizes this one
 * object by a module-private brand (the `lazy.ts` pattern) and runs the
 * render in its place; the brand never appears on the object, so a
 * consumer can neither forge it nor reach it, and the brand follows the
 * object, not the name it is registered under.
 *
 * Leaf module so `evaluator.ts` and `index.ts` import it without a cycle.
 */

import type { TemplateFunc } from "./evaluator.js";

/** Helm's `include(name string, data interface{}) (string, error)`. */
export const include: TemplateFunc = {
  // Never called: the evaluator dispatches the branded object to its own
  // render. Reaching this body means the brand check was bypassed.
  fn: () => {
    throw new Error("include was called outside the evaluator's dispatch");
  },
  argTypes: ["string", "value"],
  arity: { kind: "exact" },
  returnType: "string",
};

/** True iff `fn` is the `include` object, under whatever name it was registered. */
export function isInclude(fn: TemplateFunc): boolean {
  return fn === include;
}
