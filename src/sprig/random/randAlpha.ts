import { ALPHA, randString } from "./_prng.js";

/** `randAlpha n` — `n` random letters [A-Za-z]. */
export function randAlpha(n: number | bigint, random: () => number): string {
  return randString(Number(n), ALPHA, random);
}
