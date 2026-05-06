/** `slice list [i [j]]` — Array.prototype.slice. */
export function slice(list: unknown, i?: number | bigint, j?: number | bigint): unknown[] {
  if (!Array.isArray(list)) return [];
  const start = i === undefined ? 0 : Number(i);
  const end = j === undefined ? list.length : Number(j);
  return list.slice(start, end);
}
