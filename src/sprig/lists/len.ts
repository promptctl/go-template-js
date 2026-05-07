/**
 * Sprig `len` — same shape as the evaluator's built-in `len`. Re-exposed
 * here so the sprig category is self-contained per the epic's required
 * layout.
 *
 * [LAW:single-enforcer] Sized-kind validation lives at the gate via
 * argTypes: ["sized"]. The body picks the per-kind readout; nil and
 * non-sized values are rejected once by `enforceArgTypes`, never here.
 */
export function len(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.length;
  if (value instanceof Map) return value.size;
  if (value instanceof Set) return value.size;
  return Object.keys(value as object).length;
}
