/** All elements except the first. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function rest(list: unknown[]): unknown[] {
  return list.slice(1);
}
