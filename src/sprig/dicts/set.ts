import { bodyTypeMismatch } from "../../evaluator/errors.js";

/**
 * `set d key value` — mutates the receiver to bind `key=value` and
 * returns it. Matches Go sprig: the receiver and the returned value
 * are the same dict.
 *
 * Non-dict receivers (null, primitives, arrays, Maps) throw
 * TypeMismatchError. Go sprig's typed signature
 * `map[string]interface{}` rejects them at the template-engine
 * boundary; we get the same outcome by validating in the body.
 */
export function set(d: unknown, key: string, value: unknown): Record<string, unknown> {
  if (
    d === null ||
    d === undefined ||
    typeof d !== "object" ||
    Array.isArray(d) ||
    d instanceof Map
  ) {
    throw bodyTypeMismatch("set", 1, "dict", describeReceiver(d));
  }
  (d as Record<string, unknown>)[key] = value;
  return d as Record<string, unknown>;
}

function describeReceiver(d: unknown): string {
  if (d === null) return "null";
  if (d === undefined) return "undefined";
  if (Array.isArray(d)) return "array";
  if (d instanceof Map) return "Map";
  return typeof d;
}
