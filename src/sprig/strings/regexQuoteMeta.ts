/**
 * `regexQuoteMeta s` — escape regex metacharacters in `s` so it can be
 * embedded literally in a regex. Mirrors Go's `regexp.QuoteMeta`,
 * which backslash-escapes the set `\.+*?()|[]{}^$`.
 *
 * ECMAScript regex shares the same metacharacter set, so the escape
 * list is identical.
 */

// [LAW:single-enforcer] Kind validated at the dispatch gate; the body
// just rewrites.
export function regexQuoteMeta(s: string): string {
  return s.replace(/[\\.+*?()|[\]{}^$]/g, "\\$&");
}
