/** Unique values, preserving first-occurrence order. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function uniq(list: unknown[]): unknown[] {
  return [...new Set(list)];
}
