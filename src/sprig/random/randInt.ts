import { bodyTypeMismatch } from "../../evaluator/errors.js";
<<<<<<< HEAD
import { randIntFromRange } from "./_prng.js";
=======
import { RandIntRangeError, randIntFromRange } from "./_prng.js";
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)

/** `randInt min max` — random integer in [min, max). Mirrors Go sprig. */
export function randInt(min: number | bigint, max: number | bigint, random: () => number): number {
  try {
    return randIntFromRange(Number(min), Number(max), random);
  } catch (e) {
<<<<<<< HEAD
    if (e instanceof Error && e.message.includes("max must be greater than min")) {
=======
    if (e instanceof RandIntRangeError) {
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
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
