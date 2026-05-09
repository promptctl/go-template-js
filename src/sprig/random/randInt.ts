import { bodyTypeMismatch } from "../../evaluator/errors.js";
import { randIntFromRange } from "./_prng.js";

/** `randInt min max` — random integer in [min, max). Mirrors Go sprig. */
export function randInt(min: number | bigint, max: number | bigint, random: () => number): number {
  try {
    return randIntFromRange(Number(min), Number(max), random);
  } catch (e) {
    if (e instanceof Error && e.message.includes("max must be greater than min")) {
      throw bodyTypeMismatch(
        "randInt",
        1,
        "max > min",
        `constraint violated (max=${Number(max)}, min=${Number(min)})`,
      );
    }
    throw e;
  }
}
