/** All elements except the last. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function initial(list: unknown[]): unknown[] {
  return list.slice(0, -1);
}
