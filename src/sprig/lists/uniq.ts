/** Unique values, preserving first-occurrence order. */
export function uniq(list: unknown): unknown[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list)];
}
