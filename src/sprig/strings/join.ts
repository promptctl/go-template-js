import { bodyTypeMismatch } from "../../evaluator/errors.js";

/**
 * `join sep list` — joins a list with the separator.
 *
 * [LAW:single-enforcer] The list-shape gate is `argTypes: ["string",
 * "list"]` — non-arrays raise TypeMismatchError before this body runs.
 * The body validates each *element* because the no-silent-flatten
 * commitment ("typed values never become strings without an explicit
 * conversion") applies inside lists too: primitives stringify
 * naturally; non-primitive (typed-T) elements throw, and `evalCommand`
 * re-emits with the call-site pos.
 */
export function join(sep: string, list: readonly unknown[]): string {
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
