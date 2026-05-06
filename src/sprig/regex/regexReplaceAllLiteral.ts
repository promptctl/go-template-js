/**
 * `regexReplaceAllLiteral` — like regexReplaceAll but the replacement
 * string is treated literally ($1/$2 are not expanded).
 */
export function regexReplaceAllLiteral(pattern: string, s: string, repl: string): string {
  // Escape `$` so JS's String.prototype.replace doesn't interpret it.
  const literal = repl.replace(/\$/g, "$$$$");
  return s.replace(new RegExp(pattern, "g"), literal);
}
