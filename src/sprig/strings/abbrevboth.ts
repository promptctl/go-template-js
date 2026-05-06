/**
 * `abbrevboth left right s` — abbreviate from both ends, leaving `...`
 * around the visible window. Mirrors Go sprig's abbrevboth semantics:
 * left/right specify offsets (0-indexed); the result has `...` around
 * a slice taken between them.
 */
export function abbrevboth(left: number | bigint, right: number | bigint, s: string): string {
  const l = Number(left);
  const r = Number(right);
  if (r < 7 || s.length < r) return s;
  if (l < 0 || l > s.length - r + 1) return s;
  return `...${s.slice(l, l + r - 6)}...`;
}
