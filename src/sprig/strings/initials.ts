/**
 * `initials s` — port of `goutils.Initials` (what Go sprig's `initials`
 * delegates to): the first character of each whitespace-separated word,
 * case preserved — `"Ada Lovelace"` -> `"AL"`, `"foo bar baz"` -> `"fbb"`.
 */
export function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0] ?? "")
    .join("");
}
