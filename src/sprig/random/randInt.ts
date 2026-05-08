import { randIntFromRange } from "./_prng.js";

/** `randInt min max` — random integer in [min, max). Mirrors Go sprig. */
export function randInt(min: number | bigint, max: number | bigint, random: () => number): number {
  return randIntFromRange(Number(min), Number(max), random);
}
