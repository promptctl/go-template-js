/** `regexMatch pattern s` — true iff JS regex matches anywhere in s. */
export function regexMatch(pattern: unknown, s: unknown): boolean {
  return new RegExp(String(pattern)).test(String(s));
}
