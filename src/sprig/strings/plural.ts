/**
 * `plural one many n` — return `one` if `n == 1`, else `many`.
 * Mirrors Go sprig's `plural(one, many string, count int) string`.
 */

// [LAW:single-enforcer] Slot kinds (`["string", "string", "int"]`) are
// validated and normalized at the dispatch gate; the body receives a
// finite `number`. Bigints (>2^53 counts) are truncated at the gate
// and arrive as plain `number` — no body-side bigint comparison needed.
export function plural(one: string, many: string, n: number): string {
  return n === 1 ? one : many;
}
