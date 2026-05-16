/**
 * `untilStep start stop step` — Python-`range`-shaped integer slice.
 * Mirrors Go sprig's `untilStep(start, stop, step int) []int`. Step
 * direction must agree with the start→stop direction; mismatched signs
 * (e.g. `start < stop` with `step <= 0`) yield an empty slice rather
 * than looping forever.
 */

export function untilStep(start: number, stop: number, step: number): number[] {
  const v: number[] = [];
  if (stop < start) {
    if (step >= 0) return v;
    for (let i = start; i > stop; i += step) v.push(i);
    return v;
  }
  if (step <= 0) return v;
  for (let i = start; i < stop; i += step) v.push(i);
  return v;
}
