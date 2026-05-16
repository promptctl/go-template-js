/**
 * `abbrevboth left right s` — abbreviate from both ends, leaving `...`
 * around the visible window. Mirrors Go sprig's abbrevboth semantics:
 * left/right specify offsets (0-indexed); the result has `...` around
 * a slice taken between them.
 */
export function abbrevboth(left: number, right: number, s: string): string {
  if (right < 7 || s.length < right) return s;
  if (left < 0 || left > s.length - right + 1) return s;
  return `...${s.slice(left, left + right - 6)}...`;
}
