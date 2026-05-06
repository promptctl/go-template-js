/**
 * `toJson val` — serializes a value to compact JSON.
 *
 * Matches Go sprig in spirit but uses JS `JSON.stringify`. Note that
 * `JSON.stringify(undefined)` is undefined; we coerce that to "null"
 * for byte-equivalence with Go's encoding/json (which encodes
 * untyped-nil as null).
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value) ?? "null";
}
