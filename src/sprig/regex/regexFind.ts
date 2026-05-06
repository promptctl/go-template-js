/** `regexFind pattern s` — first match, or "" when no match. */
export function regexFind(pattern: string, s: string): string {
  const m = new RegExp(pattern).exec(s);
  return m ? m[0] : "";
}
