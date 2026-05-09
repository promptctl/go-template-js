import { parseGoLayout } from "./_parse.js";

/**
 * `toDate format value` — parse `value` string using Go's reference-time
 * layout. Returns a `Date`. Mirrors Go sprig's `toDate`.
 */
export function toDate(format: string, value: string): Date {
  return parseGoLayout(format, value);
}
