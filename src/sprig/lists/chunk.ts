/** `chunk size list` — split list into sub-lists of `size`. */
// [LAW:single-enforcer] The "int" gate truncates `size` to a finite
// integer; the "list" gate validates array-ness. Body clamps the lower
// bound to 1 (domain rule: chunks of <1 are nonsensical).
export function chunk(size: number, list: unknown[]): unknown[][] {
  const n = Math.max(1, size);
  const out: unknown[][] = [];
  for (let i = 0; i < list.length; i += n) {
    out.push(list.slice(i, i + n));
  }
  return out;
}
