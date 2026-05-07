/** `slice list [i [j]]` — Array.prototype.slice. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function slice(list: unknown[], i?: number | bigint, j?: number | bigint): unknown[] {
  const start = i === undefined ? 0 : Number(i);
  const end = j === undefined ? list.length : Number(j);
  return list.slice(start, end);
}
