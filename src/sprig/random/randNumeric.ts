import { NUMERIC, randString } from "./_prng.js";

/** `randNumeric n` — `n` random decimal digits [0-9]. */
export function randNumeric(n: number | bigint, random: () => number): string {
  return randString(Number(n), NUMERIC, random);
}
