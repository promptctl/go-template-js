/** `has item list` — true iff `item` ∈ `list`. Note arg order matches Go sprig. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function has(item: unknown, list: unknown[]): boolean {
  return list.includes(item);
}
