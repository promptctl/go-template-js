/** `regexSplit pattern s n` — split by regex, optional max count. */
export function regexSplit(pattern: string, s: string, n: number = -1): string[] {
  const re = new RegExp(pattern);
  if (n < 0) return s.split(re);
  return s.split(re).slice(0, n);
}
