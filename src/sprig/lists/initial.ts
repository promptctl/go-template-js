/** All elements except the last. */
export function initial(list: unknown): unknown[] {
  if (Array.isArray(list)) return list.slice(0, -1);
  return [];
}
