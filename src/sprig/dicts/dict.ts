import { bodyTypeMismatch } from "../../evaluator/errors.js";

/**
 * `dict k1 v1 k2 v2 …` — builds a record from alternating key/value pairs.
 *
 * [LAW:single-enforcer] The boundary gate (`enforceArgTypes`) validates
 * the first key as "string" but cannot describe the alternating pattern
 * for keys at index ≥ 2 — they fall into the trailing "any" slot. The
 * body validates every key position (every even index) as a string and
 * throws TypeMismatchError otherwise. `evalCommand` re-emits with the
 * call-site pos.
 */
export function dict(...kvs: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < kvs.length; i += 2) {
    const key = kvs[i];
    if (typeof key !== "string") {
      throw bodyTypeMismatch("dict", i + 1, "string", describeValue(key));
    }
    out[key] = kvs[i + 1];
  }
  return out;
}

function describeValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "Map";
  return typeof v;
}
