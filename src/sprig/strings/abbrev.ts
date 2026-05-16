/**
 * `abbrev width s` — truncate `s` to `width` chars, replacing the tail
 * with `...` when truncation occurs. Width must be at least 4 to fit
 * the ellipsis; smaller widths return `s` unchanged (Go sprig
 * behavior).
 */
export function abbrev(width: number, s: string): string {
  if (s.length <= width) return s;
  if (width < 4) return s;
  return `${s.slice(0, width - 3)}...`;
}
