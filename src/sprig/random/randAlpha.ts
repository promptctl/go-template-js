import { ALPHA, randString } from "./_prng.js";

/** `randAlpha n` — `n` random letters [A-Za-z]. */
export function randAlpha(n: number, random: () => number): string {
  return randString(n, ALPHA, random);
}
