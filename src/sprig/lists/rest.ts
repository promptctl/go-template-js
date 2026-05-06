/** All elements except the first. */
export function rest(list: unknown): unknown[] {
  if (Array.isArray(list)) return list.slice(1);
  return [];
}
