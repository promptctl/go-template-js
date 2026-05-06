/** `regexFind pattern s` — first match, or "" when no match. */
export function regexFind(pattern: unknown, s: unknown): string {
  const m = new RegExp(String(pattern)).exec(String(s));
  return m ? m[0] : "";
}
