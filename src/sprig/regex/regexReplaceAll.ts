/**
 * `regexReplaceAll pattern s repl` — replace ALL pattern matches with
 * the replacement string. Replacement supports JS's $1/$2/$<name>
 * backreference syntax.
 */
export function regexReplaceAll(pattern: unknown, s: unknown, repl: unknown): string {
  return String(s).replace(new RegExp(String(pattern), "g"), String(repl));
}
