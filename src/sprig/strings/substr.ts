/**
 * `substr i j s` — substring [i, j) with out-of-range clamping.
 * Matches Go sprig's behavior of clamping rather than throwing.
 */
export function substr(start: number, end: number, s: string): string {
  let i = Math.max(0, start);
  const j = end > s.length ? s.length : end;
  if (i > j) i = j;
  return s.slice(i, j);
}
