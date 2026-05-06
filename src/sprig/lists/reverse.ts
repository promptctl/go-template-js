export function reverse(list: unknown): unknown[] {
  if (Array.isArray(list)) return [...list].reverse();
  return [];
}
