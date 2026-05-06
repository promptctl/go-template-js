/** `regexMatch pattern s` — true iff JS regex matches anywhere in s. */
export function regexMatch(pattern: string, s: string): boolean {
  return new RegExp(pattern).test(s);
}
