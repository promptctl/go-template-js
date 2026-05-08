/**
 * `toRawJson v` — JSON-encode without HTML escaping. Go uses a json
 * encoder with `SetEscapeHTML(false)`; JS `JSON.stringify` does not
 * HTML-escape by default, so the function is a direct mapping.
 *
 * The undefined→"null" coercion matches Go's `encoding/json` (which
 * encodes untyped-nil as `null`); JS would otherwise return
 * `undefined` and break callers expecting a string.
 */
// [LAW:single-enforcer] The "serializable" gate already rejects
// functions/symbols/circular refs upstream, so the body trusts the
// kind and only routes the encoding step.
export function toRawJson(value: unknown): string {
  return JSON.stringify(value) ?? "null";
}
