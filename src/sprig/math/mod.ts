/** `mod a b` — modulo. JS `%` matches Go's: sign follows the dividend. */
export function mod(a: unknown, b: unknown): number {
  return Math.trunc(Number(a)) % Math.trunc(Number(b));
}
