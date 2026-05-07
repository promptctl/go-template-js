/** `without list a b c …` — drop any of a/b/c… from list. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function without(list: unknown[], ...exclude: unknown[]): unknown[] {
  const set = new Set(exclude);
  return list.filter((v) => !set.has(v));
}
