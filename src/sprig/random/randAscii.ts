import { ASCII, randString } from "./_prng.js";

/** `randAscii n` — `n` random printable ASCII characters (0x20–0x7E). */
export function randAscii(n: number | bigint, random: () => number): string {
  return randString(Number(n), ASCII, random);
}
