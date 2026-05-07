// [LAW:single-enforcer] The "list" gate validates array-ness.
export function reverse(list: unknown[]): unknown[] {
  return [...list].reverse();
}
