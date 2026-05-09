/**
 * `seq …` — space-joined integer sequence. Mirrors Go sprig's `seq`,
 * which dispatches on arity and is **inclusive** of the end value:
 *
 *   seq()              → ""
 *   seq(end)           → 1..end (descending if end<1)
 *   seq(start, end)    → start..end (step ±1 by direction)
 *   seq(start, step, end) → stepped, end inclusive when reached
 *   4+ args            → ""
 *
 * Inclusivity is implemented the same way Go does it — by passing
 * `end + increment` (or `end + step` for the 2-arg case) into the
 * exclusive `untilStep`. The 3-arg form returns "" when the bounds
 * descend (`end < start`) but the caller passes a positive step —
 * matching Go's early-return at `if step > 0 { return "" }`.
 *
 * Output is the int slice joined with " ", so `{{ seq 5 }}` emits
 * `1 2 3 4 5`. Result type is `string`, **not** `number[]`.
 */

import { untilStep } from "./untilStep.js";

// [LAW:single-enforcer] Slot kind ("number") validates types upstream;
// the dispatch shape (which arity does what) is the body's
// responsibility — Go puts it inside `seq`, so we do too.
export function seq(...params: (number | bigint)[]): string {
  const ints = params.map((v) => Math.trunc(Number(v)));
  let increment = 1;
  switch (ints.length) {
    case 0:
      return "";
    case 1: {
      const start = 1;
      const end = ints[0] as number;
      if (end < start) increment = -1;
      return untilStep(start, end + increment, increment).join(" ");
    }
    case 2: {
      const start = ints[0] as number;
      const end = ints[1] as number;
      const step = end < start ? -1 : 1;
      return untilStep(start, end + step, step).join(" ");
    }
    case 3: {
      const start = ints[0] as number;
      const step = ints[1] as number;
      const end = ints[2] as number;
      if (end < start) {
        increment = -1;
        if (step > 0) return "";
      }
      return untilStep(start, end + increment, step).join(" ");
    }
    default:
      return "";
  }
}
