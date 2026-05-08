/**
 * `plural one many n` — return `one` if `n == 1`, else `many`.
 * Mirrors Go sprig's `plural(one, many string, count int) string`.
 */

// [LAW:single-enforcer] Slot kinds (`["string", "string", "int"]`) are
// validated at the dispatch gate; the body trusts them. Bigint comes
// in via the "int" slot for >2^53 counts — convert to a comparison
// against 1 that works for both.
export function plural(one: string, many: string, n: number | bigint): string {
  return n === 1 || n === 1n ? one : many;
}
