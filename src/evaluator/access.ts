/**
 * Field / index access for evaluator primaries.
 *
 * Mirrors Go's `text/template` semantics where applicable:
 * - Plain JS objects: own + prototype-chain properties.
 * - Maps: `.get(key)`.
 * - Arrays: numeric `[i]` (string-indexed access not supported — that's
 *   Go's behavior for slices/arrays).
 * - Methods/functions are returned as-is for the caller to invoke when
 *   the AST shape demands a function call.
 *
 * [LAW:no-defensive-null-guards] A null guard would skip the access,
 * which silently produces `undefined`. That's the bug Go template's
 * default `missingkey=error` mode prevents. We surface the missing
 * field as an explicit caller-handled signal (the `MISSING` sentinel)
 * rather than swallowing it.
 */

/** Sentinel returned by `getField` when a field is genuinely absent. */
export const MISSING: unique symbol = Symbol("go-template-js.MISSING");
export type Missing = typeof MISSING;

export function getField(value: unknown, name: string): unknown | Missing {
  if (value === null || value === undefined) return MISSING;
  if (value instanceof Map) {
    return value.has(name) ? value.get(name) : MISSING;
  }
  if (Array.isArray(value)) {
    // Per Go, accessing a named field on a slice is a missing-field
    // error — no `length` magic. The numeric `index` builtin handles
    // positional access in a separate ticket.
    return MISSING;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (name in obj) return obj[name];
    return MISSING;
  }
  return MISSING;
}

/**
 * Walk a chain of field names left-to-right. Returns `MISSING` as soon
 * as any link is missing. The caller decides how to surface the error
 * (typically via EvalError pointing at the AST node's position).
 */
export function walkFieldChain(value: unknown, idents: readonly string[]): unknown | Missing {
  let cur: unknown = value;
  for (const id of idents) {
    if (cur === MISSING) return MISSING;
    cur = getField(cur, id);
  }
  return cur;
}
