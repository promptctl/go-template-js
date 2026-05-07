/** `append list item` — add item at the end. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function append(list: unknown[], item: unknown): unknown[] {
  return [...list, item];
}
