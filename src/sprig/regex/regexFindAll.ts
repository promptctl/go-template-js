/**
 * `regexFindAll pattern s n` — first `n` matches (or all if n<0).
 * Mirrors Go sprig's signature: pattern, s, then optional n.
 */
export function regexFindAll(pattern: string, s: string, n: number = -1): string[] {
  const re = new RegExp(pattern, "g");
  const out: string[] = [];
  for (const m of s.matchAll(re)) {
    // Check before push so n=0 returns [] (Go regexp.FindAllString parity:
    // a non-negative n means *at most* n matches; n=0 means zero).
    if (n >= 0 && out.length >= n) break;
    out.push(m[0]);
  }
  return out;
}
