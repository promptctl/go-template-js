import { kindOf } from "./kindOf.js";

/**
 * `typeOf v` — for JS, essentially the same as kindOf, with the
 * caveat that "object" is the catch-all for plain dicts and class
 * instances. Go's reflect.Type would distinguish struct names; we
 * don't have that info at runtime.
 */
export function typeOf(value: unknown): string {
  return kindOf(value);
}
