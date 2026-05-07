/**
 * Internal lazy-func registry.
 *
 * `and` / `or` short-circuit by receiving thunks instead of values. The
 * dispatcher needs to know which funcs want thunks, but the public
 * `TemplateFunc` interface must not advertise (or admit) a way for
 * consumer code to opt in — only the builtins module does that.
 *
 * [LAW:single-enforcer] One side-channel — a module-private WeakSet —
 * holds the set of lazy funcs. `markLazy` is the only writer (called by
 * `defaultBuiltins`); `isLazy` is the only reader (called by the
 * dispatcher). The brand never appears on the func object, so it
 * cannot leak into the published `.d.ts` and it is not reachable via
 * any public symbol or string key.
 *
 * Lives in its own leaf module so both `evaluator.ts` and `builtins.ts`
 * can import it without forming a runtime import cycle.
 */

import type { TemplateFunc } from "./evaluator.js";

const LAZY_FUNCS = new WeakSet<TemplateFunc>();

/** Mark a func as wanting thunks. Internal — only `defaultBuiltins` calls this. */
export function markLazy<F extends TemplateFunc>(fn: F): F {
  LAZY_FUNCS.add(fn);
  return fn;
}

/** True iff the func was registered via `markLazy`. */
export function isLazy(fn: TemplateFunc): boolean {
  return LAZY_FUNCS.has(fn);
}
