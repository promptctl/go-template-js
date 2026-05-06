/**
 * `fromJson s` — parses a JSON string into a value.
 *
 * Returns the parsed value. Throws if the input is not valid JSON,
 * matching Go sprig's behaviour (Go sprig propagates the parse error).
 */

export function fromJson(input: unknown): unknown {
  if (typeof input !== "string") {
    throw new Error(`fromJson: expected string, got ${typeof input}`);
  }
  return JSON.parse(input);
}
