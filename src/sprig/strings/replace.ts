/** Replaces ALL occurrences of `old` with `nw` in `s` (Go's strings.Replace n=-1). */
export function replace(old: unknown, nw: unknown, s: unknown): string {
  return String(s).split(String(old)).join(String(nw));
}
