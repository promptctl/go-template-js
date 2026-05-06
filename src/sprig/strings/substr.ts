/**
 * `substr i j s` — substring [i, j) with out-of-range clamping.
 * Matches Go sprig's behavior of clamping rather than throwing.
 */
export function substr(start: unknown, end: unknown, s: unknown): string {
  const str = String(s);
  let i = Math.max(0, Number(start));
  let j = end === undefined || end === null ? str.length : Number(end);
  if (j > str.length) j = str.length;
  if (i > j) i = j;
  return str.slice(i, j);
}
