/** `append list item` — add item at the end. */
export function append(list: unknown, item: unknown): unknown[] {
  if (!Array.isArray(list)) return [item];
  return [...list, item];
}
