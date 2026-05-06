/**
 * Internal lazy-func brand.
 *
 * Lives in its own leaf module so both `evaluator.ts` (which references
 * the brand on the `TemplateFunc` interface) and `builtins.ts` (which
 * stamps it on `and`/`or` and reads it in `isLazy`) can import it
 * without forming a runtime import cycle.
 *
 * [LAW:one-source-of-truth] One symbol identifies "this func wants
 * thunks, not values." Not exported from the public entrypoint, so
 * consumer-defined funcs cannot satisfy the brand.
 */

export const LAZY: unique symbol = Symbol.for("go-template-js.lazy");
export type LazyBrand = typeof LAZY;
