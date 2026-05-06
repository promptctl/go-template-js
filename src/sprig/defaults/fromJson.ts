/**
 * `fromJson s` — parses a JSON string into a value.
 *
 * Returns the parsed value. Throws if the input is not valid JSON,
 * matching Go sprig's behaviour (Go sprig propagates the parse error).
 */

export function fromJson(input: string): unknown {
  return JSON.parse(input);
}
