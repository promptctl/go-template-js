/**
 * Internal PRNG seam for sprig random functions.
 *
 * [LAW:single-enforcer] All randomness in this module routes through
 * the `random` parameter — never through `Math.random` directly. The
 * caller supplies the source; these helpers consume it.
 */

export const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NUMERIC = "0123456789";
// ASCII printable range 32–126 inclusive (matches Go sprig: Intn(95)+32).
export const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join("");

export function randString(n: number, charset: string, random: () => number): string {
  let result = "";
  for (let i = 0; i < n; i++) {
    result += charset[Math.floor(random() * charset.length)];
  }
  return result;
}

/** Inclusive `min`, exclusive `max` — mirrors Go `rand.Intn(max-min)+min`. */
export function randIntFromRange(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min)) + min;
}
