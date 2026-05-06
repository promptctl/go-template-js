/** `prepend list item` — add item at the front. */
export function prepend(list: unknown, item: unknown): unknown[] {
  if (!Array.isArray(list)) return [item];
  return [item, ...list];
}
