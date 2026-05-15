/**
 * `maxf a b c …` — variadic float-typed maximum. Mirrors Go sprig's
 * `maxf` (float64, no truncation). Distinct from `max` (int64-truncated).
 */
export function maxf(...args: number[]): number {
  return args.reduce((m, v) => Math.max(m, v), -Infinity);
}
