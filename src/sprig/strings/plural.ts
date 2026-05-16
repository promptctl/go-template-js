/**
 * `plural one many n` — return `one` if `n == 1`, else `many`.
 * Mirrors Go sprig's `plural(one, many string, count int) string`.
 */

// [LAW:single-enforcer] Slot kinds (`["string", "string", "int"]`) are
// validated and normalized at the dispatch gate; the body receives a
// finite `number`. Safe-integer bigints (|n| ≤ 2^53) normalize through
// the gate to plain `number`; bigints outside that range are rejected
// at the gate (precision-loss is a magnitude failure, not a tradeoff).
// Either way, no body-side bigint comparison is needed.
export function plural(one: string, many: string, n: number): string {
  return n === 1 ? one : many;
}
