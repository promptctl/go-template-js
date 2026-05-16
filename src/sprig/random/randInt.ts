import { bodyTypeMismatch } from "../../evaluator/errors.js";
import { RandIntRangeError, randIntFromRange } from "./_prng.js";

/** `randInt min max` — random integer in [min, max). Mirrors Go sprig. */
export function randInt(min: number, max: number, random: () => number): number {
  try {
    return randIntFromRange(min, max, random);
  } catch (e) {
    if (e instanceof RandIntRangeError) {
      throw bodyTypeMismatch(
        "randInt",
        1,
        "max > min",
        `constraint violated (max=${max}, min=${min})`,
      );
    }
    throw e;
  }
}
