/**
 * `abbrevboth left right s` — abbreviate from both ends, leaving `...`
 * around the visible window. Mirrors Go sprig's abbrevboth semantics:
 * left/right specify offsets (0-indexed); the result has `...` around
 * a slice taken between them.
 */
export function abbrevboth(left: unknown, right: unknown, s: unknown): string {
  const l = Number(left);
  const r = Number(right);
  const str = String(s);
  if (r < 7 || str.length < r) return str;
  if (l < 0 || l > str.length - r + 1) return str;
  return `...${str.slice(l, l + r - 6)}...`;
}
