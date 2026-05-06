/**
 * `regexReplaceAllLiteral` — like regexReplaceAll but the replacement
 * string is treated literally ($1/$2 are not expanded).
 */
export function regexReplaceAllLiteral(pattern: unknown, s: unknown, repl: unknown): string {
  // Escape `$` so JS's String.prototype.replace doesn't interpret it.
  const literal = String(repl).replace(/\$/g, "$$$$");
  return String(s).replace(new RegExp(String(pattern), "g"), literal);
}
