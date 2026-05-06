/** `has item list` — true iff `item` ∈ `list`. Note arg order matches Go sprig. */
export function has(item: unknown, list: unknown): boolean {
  if (!Array.isArray(list)) return false;
  return list.includes(item);
}
