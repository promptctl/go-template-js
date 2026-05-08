/**
 * `add1f n` — float increment. Mirrors Go sprig's
 * `add1f(i interface{}) float64`, which converts `i` to float64 and
 * adds 1.0 — no truncation.
 */
export function add1f(n: number | bigint): number {
  return Number(n) + 1;
}
