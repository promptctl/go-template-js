/** `without list a b c …` — drop any of a/b/c… from list. */
export function without(list: unknown, ...exclude: unknown[]): unknown[] {
  if (!Array.isArray(list)) return [];
  const set = new Set(exclude);
  return list.filter((v) => !set.has(v));
}
