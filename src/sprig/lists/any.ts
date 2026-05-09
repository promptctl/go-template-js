/**
 * `any v1 v2 …` — true iff `empty(x)` is false for at least one
 * argument. An empty argument list returns false.
 *
 * [LAW:one-source-of-truth] Truthiness uses the same `empty()` helper
 * the rest of the sprig surface (default, coalesce, empty) routes
 * through, so "is this empty?" has exactly one answer.
 */

import { empty } from "../defaults/empty.js";

export function any(...values: readonly unknown[]): boolean {
  for (const v of values) {
    if (!empty(v)) return true;
  }
  return false;
}
