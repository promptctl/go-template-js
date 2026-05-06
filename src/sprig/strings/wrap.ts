/**
 * `wrap width s` — soft-wrap `s` to `width` columns at word boundaries.
 * Lines longer than width that contain no spaces are emitted as-is.
 */
export function wrap(width: unknown, s: unknown): string {
  return wrapWithSeparator(Number(width), "\n", String(s));
}

export function wrapWithSeparator(width: number, sep: string, s: string): string {
  if (!Number.isFinite(width) || width <= 0) return s;
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (word.length === 0) continue;
      if (line.length === 0) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += ` ${word}`;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out.join(sep);
}
