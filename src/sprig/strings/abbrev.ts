/**
 * `abbrev width s` — truncate `s` to `width` chars, replacing the tail
 * with `...` when truncation occurs. Width must be at least 4 to fit
 * the ellipsis; smaller widths return `s` unchanged (Go sprig
 * behavior).
 */
export function abbrev(width: unknown, s: unknown): string {
  const w = Number(width);
  const str = String(s);
  if (str.length <= w) return str;
  if (w < 4) return str;
  return `${str.slice(0, w - 3)}...`;
}
