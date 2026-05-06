/**
 * Sprig `len` — same shape as the evaluator's built-in `len`. Re-exposed
 * here so the sprig category is self-contained per the epic's required
 * layout.
 */
export function len(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.length;
  if (value instanceof Map) return value.size;
  if (value instanceof Set) return value.size;
  if (typeof value === "object") return Object.keys(value as object).length;
  return 0;
}
