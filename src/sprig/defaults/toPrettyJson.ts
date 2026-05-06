/**
 * `toPrettyJson val` — JSON with 2-space indentation, matching Go
 * sprig's output exactly.
 */

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "null";
}
