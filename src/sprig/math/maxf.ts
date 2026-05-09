/**
 * `maxf a b c …` — variadic float-typed maximum. Mirrors Go sprig's
 * `maxf`, which converts every arg to float64 (no truncation) before
 * comparing. Distinct from `max`, which Go sprig truncates to int64.
 */
export function maxf(...args: (number | bigint)[]): number {
  return Math.max(...args.map((v) => Number(v)));
}
