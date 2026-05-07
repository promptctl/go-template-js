import { bodyTypeMismatch } from "../../evaluator/errors.js";

/**
 * `unset d key` — mutates the receiver to drop `key` and returns it.
 * Matches Go sprig: the receiver and the returned value are the same
 * dict.
 *
 * Non-dict receivers (null, primitives, arrays, Maps) throw
 * TypeMismatchError — see `set` for the rationale.
 */
export function unset(d: unknown, key: string): Record<string, unknown> {
  if (
    d === null ||
    d === undefined ||
    typeof d !== "object" ||
    Array.isArray(d) ||
    d instanceof Map
  ) {
    throw bodyTypeMismatch("unset", 1, "dict", describeReceiver(d));
  }
  delete (d as Record<string, unknown>)[key];
  return d as Record<string, unknown>;
}

function describeReceiver(d: unknown): string {
  if (d === null) return "null";
  if (d === undefined) return "undefined";
  if (Array.isArray(d)) return "array";
  if (d instanceof Map) return "Map";
  return typeof d;
}
