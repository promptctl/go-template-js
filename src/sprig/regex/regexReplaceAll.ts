/**
 * `regexReplaceAll pattern s repl` — replace ALL pattern matches with
 * the replacement string. Replacement supports JS's $1/$2/$<name>
 * backreference syntax.
 */
export function regexReplaceAll(pattern: string, s: string, repl: string): string {
  return s.replace(new RegExp(pattern, "g"), repl);
}
