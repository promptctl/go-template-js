/**
 * Go-template truthiness, used by `if`, `with`, and `range`-empty.
 *
 * Per https://pkg.go.dev/text/template#hdr-Actions, "the empty values
 * are false, 0, any nil pointer or interface value, and any array,
 * slice, map, or string of length zero." Strings of length zero are
 * also empty.
 */

export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  if (value instanceof Set) return value.size > 0;
  // Plain object — empty iff it has no own enumerable string keys.
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}
