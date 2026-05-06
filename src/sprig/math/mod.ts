/** `mod a b` — modulo. JS `%` matches Go's: sign follows the dividend. */
export function mod(a: number | bigint, b: number | bigint): number {
  return Math.trunc(Number(a)) % Math.trunc(Number(b));
}
