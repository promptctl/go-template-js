/** `slice list [i [j]]` — Array.prototype.slice. */
// [LAW:single-enforcer] The "list" and "int" gates validate array-ness
// and integer-ness; missing trailing args remain undefined (the gate
// loops only over present values), so i/j stay optional but never null.
export function slice(list: unknown[], i?: number, j?: number): unknown[] {
  const start = i === undefined ? 0 : i;
  const end = j === undefined ? list.length : j;
  return list.slice(start, end);
}
