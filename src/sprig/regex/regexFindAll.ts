/**
 * `regexFindAll pattern s n` — first `n` matches (or all if n<0).
 * Mirrors Go sprig's signature: pattern, s, then optional n.
 */
export function regexFindAll(pattern: string, s: string, n: number | bigint = -1): string[] {
  const re = new RegExp(pattern, "g");
  const limit = Number(n);
  const out: string[] = [];
  for (const m of s.matchAll(re)) {
    out.push(m[0]);
    if (limit >= 0 && out.length >= limit) break;
  }
  return out;
}
