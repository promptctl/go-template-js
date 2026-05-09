/**
 * Internal PRNG seam for sprig random functions.
 *
 * [LAW:single-enforcer] All randomness in this module routes through
 * the `random` parameter — never through `Math.random` directly. The
 * caller supplies the source; these helpers consume it.
 */

export class RandIntRangeError extends Error {
  constructor(min: number, max: number) {
    super(`randIntFromRange: max must be greater than min (max=${max}, min=${min})`);
    this.name = "RandIntRangeError";
  }
}

export const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NUMERIC = "0123456789";
// ASCII printable range 32–126 inclusive (matches Go sprig: Intn(95)+32).
export const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join("");

export function randString(n: number, charset: string, random: () => number): string {
  const chars = [];
  for (let i = 0; i < n; i++) {
    chars.push(charset[Math.floor(random() * charset.length)]!);
  }
  return chars.join("");
}

/** Inclusive `min`, exclusive `max` — mirrors Go `rand.Intn(max-min)+min`. */
export function randIntFromRange(min: number, max: number, random: () => number): number {
  if (max <= min) throw new RandIntRangeError(min, max);
  return Math.floor(random() * (max - min)) + min;
}
