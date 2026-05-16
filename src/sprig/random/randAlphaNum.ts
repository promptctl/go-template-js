import { ALPHANUM, randString } from "./_prng.js";

/** `randAlphaNum n` — `n` random alphanumeric characters [A-Za-z0-9]. */
export function randAlphaNum(n: number, random: () => number): string {
  return randString(n, ALPHANUM, random);
}
