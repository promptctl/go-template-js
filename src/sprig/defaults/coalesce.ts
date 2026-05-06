/**
 * `coalesce a b c …` — returns the first non-empty argument, or
 * undefined if none are non-empty.
 */

import { empty } from "./empty.js";

export function coalesce(...values: readonly unknown[]): unknown {
  for (const v of values) {
    if (!empty(v)) return v;
  }
  return undefined;
}
