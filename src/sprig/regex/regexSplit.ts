/** `regexSplit pattern s n` — split by regex, optional max count. */
export function regexSplit(pattern: unknown, s: unknown, n: unknown = -1): string[] {
  const re = new RegExp(String(pattern));
  const limit = Number(n);
  if (limit < 0) return String(s).split(re);
  return String(s).split(re).slice(0, limit);
}
