/**
 * `regexFindAll pattern s n` — first `n` matches (or all if n<0).
 * Mirrors Go sprig's signature: pattern, s, then optional n.
 */
export function regexFindAll(pattern: string, s: string, n: number = -1): string[] {
  const re = new RegExp(pattern, "g");
  const out: string[] = [];
  for (const m of s.matchAll(re)) {
    out.push(m[0]);
    if (n >= 0 && out.length >= n) break;
  }
  return out;
}
