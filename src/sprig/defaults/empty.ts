/**
 * `empty val` — true if `val` is "empty" per Go sprig's rules:
 *   nil, false, 0, 0.0, "", empty array/Map/object.
 *
 * Note: `empty 0` is true (this surprises newcomers — Go sprig matches
 * Go's reflect-IsZero semantics).
 */

export function empty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === false) return true;
  if (typeof value === "number") return value === 0 || Number.isNaN(value);
  if (typeof value === "bigint") return value === 0n;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map) return value.size === 0;
  if (value instanceof Set) return value.size === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}
