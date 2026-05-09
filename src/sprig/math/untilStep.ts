/**
 * `untilStep start stop step` — Python-`range`-shaped integer slice.
 * Mirrors Go sprig's `untilStep(start, stop, step int) []int`. Step
 * direction must agree with the start→stop direction; mismatched signs
 * (e.g. `start < stop` with `step <= 0`) yield an empty slice rather
 * than looping forever.
 *
 * Inputs flow through `Math.trunc(Number(v))` so the slot stays "number"
 * (consistent with the rest of `sprig/math`) while the body acts on
 * Go's `int` view.
 */

// [LAW:single-enforcer] Slot kind ("number") validates types upstream.
// The body owns the int-truncation pass — the `number → int` shape is
// part of the *function*, not the gate.
export function untilStep(
  start: number | bigint,
  stop: number | bigint,
  step: number | bigint,
): number[] {
  const a = Math.trunc(Number(start));
  const b = Math.trunc(Number(stop));
  const s = Math.trunc(Number(step));
  const v: number[] = [];
  if (b < a) {
    if (s >= 0) return v;
    for (let i = a; i > b; i += s) v.push(i);
    return v;
  }
  if (s <= 0) return v;
  for (let i = a; i < b; i += s) v.push(i);
  return v;
}
