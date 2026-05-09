/**
 * `add1 n` — integer increment. Mirrors Go sprig's
 * `add1(i interface{}) int64`, which truncates `i` to int before
 * adding one. Bigint inputs flow through `Number(v)` (same shape as
 * the rest of `sprig/math`); the gate enforces "number" upstream.
 */
export function add1(n: number | bigint): number {
  return Math.trunc(Number(n)) + 1;
}
