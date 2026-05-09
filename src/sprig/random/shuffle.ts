import { clampRandom } from "./_prng";

/**
 * `shuffle s` — returns a randomly permuted copy of `s`.
 *
 * Operates on Unicode code points (matching Go sprig's rune-level Fisher-Yates).
 */
export function shuffle(s: string, random: () => number): string {
  const runes = [...s];
  for (let i = runes.length - 1; i > 0; i--) {
    const j = Math.floor(clampRandom(random()) * (i + 1));
    const tmp = runes[i] as string;
    runes[i] = runes[j] as string;
    runes[j] = tmp;
  }
  return runes.join("");
}
