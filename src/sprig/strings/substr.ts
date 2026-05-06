/**
 * `substr i j s` — substring [i, j) with out-of-range clamping.
 * Matches Go sprig's behavior of clamping rather than throwing.
 */
export function substr(start: number | bigint, end: number | bigint, s: string): string {
  let i = Math.max(0, Number(start));
  let j = end === undefined || end === null ? s.length : Number(end);
  if (j > s.length) j = s.length;
  if (i > j) i = j;
  return s.slice(i, j);
}
