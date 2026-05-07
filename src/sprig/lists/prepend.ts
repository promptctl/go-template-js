/** `prepend list item` — add item at the front. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function prepend(list: unknown[], item: unknown): unknown[] {
  return [item, ...list];
}
