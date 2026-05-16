/**
 * `until count` — `[0, 1, …, count-1]` for positive counts, or
 * `[0, -1, …, count+1]` for negative counts. Mirrors Go sprig's
 * `until`, which derives step direction from the sign of `count`
 * and delegates to `untilStep`.
 */

import { untilStep } from "./untilStep.js";

export function until(count: number): number[] {
  return untilStep(0, count, count < 0 ? -1 : 1);
}
