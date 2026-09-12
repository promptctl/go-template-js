import { runes } from "../strings/runes.js";
import { clampRandom } from "./_prng.js";

/**
 * `shuffle s` — returns a randomly permuted copy of `s`.
 *
 * Operates on Unicode code points (matching Go sprig's rune-level Fisher-Yates).
 */
export function shuffle(s: string, random: () => number): string {
  const cps = runes(s);
  for (let i = cps.length - 1; i > 0; i--) {
    const j = Math.floor(clampRandom(random()) * (i + 1));
    const tmp = cps[i] as string;
    cps[i] = cps[j] as string;
    cps[j] = tmp;
  }
  return cps.join("");
}
