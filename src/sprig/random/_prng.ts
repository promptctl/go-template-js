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

/** Clamp PRNG output to [0, 1) to defend against out-of-range injected sources. */
export function clampRandom(value: number): number {
  // [LAW:no-defensive-null-guards] Non-finite check is valid here: `random`
  // is caller-supplied (trust boundary), and NaN/Infinity are out-of-range.
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 0.9999999999999999));
}

export const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const NUMERIC = "0123456789";
// ASCII printable range 32–126 inclusive (matches Go sprig: Intn(95)+32).
export const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join("");

export function randString(n: number, charset: string, random: () => number): string {
  const chars = [];
  for (let i = 0; i < n; i++) {
    chars.push(charset.charAt(Math.floor(clampRandom(random()) * charset.length)));
  }
  return chars.join("");
}

/** Inclusive `min`, exclusive `max` — mirrors Go `rand.Intn(max-min)+min`. */
export function randIntFromRange(min: number, max: number, random: () => number): number {
  if (max <= min) throw new RandIntRangeError(min, max);
  return Math.floor(clampRandom(random()) * (max - min)) + min;
}
