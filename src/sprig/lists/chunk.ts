/** `chunk size list` — split list into sub-lists of `size`. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function chunk(size: number | bigint, list: unknown[]): unknown[][] {
  const n = Math.max(1, Math.trunc(Number(size)));
  const out: unknown[][] = [];
  for (let i = 0; i < list.length; i += n) {
    out.push(list.slice(i, i + n));
  }
  return out;
}
