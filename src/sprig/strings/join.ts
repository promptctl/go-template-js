import { bodyTypeMismatch } from "../../evaluator/errors.js";

/**
 * `join sep list` — joins a list with the separator.
 *
 * [LAW:single-enforcer] The architectural commitment from the README
 * — "typed values never become strings without an explicit conversion"
 * — applies *inside* lists too. The boundary gate validates `list` as
 * "any" (it has to: lists are heterogeneous), so the body validates
 * each element. Primitives stringify naturally; non-primitive (typed-T)
 * elements throw TypeMismatchError, which `evalCommand` re-emits with
 * the call-site pos.
 */
export function join(sep: string, list: unknown): string {
  if (!Array.isArray(list)) return "";
  const parts: string[] = [];
  for (const v of list) {
    if (v !== null && v !== undefined && typeof v === "object") {
      throw bodyTypeMismatch(
        "join",
        2,
        "list of strings/primitives",
        `list element of type ${describe(v)}`,
      );
    }
    parts.push(String(v));
  }
  return parts.join(sep);
}

function describe(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "Map";
  if (v instanceof Set) return "Set";
  return "object";
}
