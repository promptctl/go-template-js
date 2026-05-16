/**
 * `substr i j s` — substring [i, j) with out-of-range clamping.
 * Matches Go sprig's behavior of clamping rather than throwing:
 * negative `end` (and any `end > s.length`) clamps to `s.length`;
 * `start` clamps to `[0, end]`.
 */
export function substr(start: number, end: number, s: string): string {
  const j = end < 0 || end > s.length ? s.length : end;
  const i = Math.min(Math.max(0, start), j);
  return s.slice(i, j);
}
