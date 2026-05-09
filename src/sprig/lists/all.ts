/**
 * `all v1 v2 …` — true iff `empty(x)` is false for every argument.
 * An empty argument list returns true (Go sprig: vacuous truth).
 *
 * [LAW:one-source-of-truth] Truthiness uses the same `empty()` helper
 * the rest of the sprig surface (default, coalesce, empty) routes
 * through, so "is this empty?" has exactly one answer.
 */

import { empty } from "../defaults/empty.js";

export function all(...values: readonly unknown[]): boolean {
  for (const v of values) {
    if (empty(v)) return false;
  }
  return true;
}
