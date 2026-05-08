/**
 * `sortAlpha list` — stringify each element, sort lexicographically.
 * Returns `string[]`.
 *
 * Mirrors Go sprig's `sortAlpha`, which calls `strslice` (skips nil
 * entries, stringifies the rest via `strval`) then `sort.StringSlice`.
 * `String(v)` lines up with Go's `%v` for primitives; non-ASCII byte
 * ordering is identical to Go's `sort.StringSlice` for ASCII input
 * (the only kind the conformance fixtures exercise).
 */

// [LAW:single-enforcer] The "list" gate validates array-ness.
export function sortAlpha(list: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const v of list) {
    // Go's `strslice` skips nil entries — match.
    if (v === null || v === undefined) continue;
    out.push(String(v));
  }
  return out.sort();
}
