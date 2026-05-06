/** Replaces ALL occurrences of `old` with `nw` in `s` (Go's strings.Replace n=-1). */
export function replace(old: string, nw: string, s: string): string {
  return s.split(old).join(nw);
}
