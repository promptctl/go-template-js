/**
 * Sprig random functions — `randInt`, `randAlpha`, `randAlphaNum`,
 * `randNumeric`, `randAscii`, `shuffle`.
 *
 * [LAW:single-enforcer] The `random` parameter is the *only* source of
 * randomness in this module. All six functions receive it from the
 * factory closure so there is one seam, not six.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { randAlpha } from "./randAlpha.js";
import { randAlphaNum } from "./randAlphaNum.js";
import { randAscii } from "./randAscii.js";
import { randInt } from "./randInt.js";
import { randNumeric } from "./randNumeric.js";
import { shuffle } from "./shuffle.js";

export { randAlpha, randAlphaNum, randAscii, randInt, randNumeric, shuffle };

/**
 * Build the sprig random FuncMap.
 *
 * @param random - PRNG source. Defaults to `Math.random`. Pass a seeded
 *   generator for reproducible templates (matches `EngineConfig.random`).
 */
export function sprigRandom(random: () => number = Math.random): FuncMap {
  return {
    randInt: {
      fn: (min, max) => randInt(min as number | bigint, max as number | bigint, random),
      argTypes: ["number", "number"],
    },
    randAlpha: {
      fn: (n) => randAlpha(n as number | bigint, random),
      argTypes: ["number"],
    },
    randAlphaNum: {
      fn: (n) => randAlphaNum(n as number | bigint, random),
      argTypes: ["number"],
    },
    randNumeric: {
      fn: (n) => randNumeric(n as number | bigint, random),
      argTypes: ["number"],
    },
    randAscii: {
      fn: (n) => randAscii(n as number | bigint, random),
      argTypes: ["number"],
    },
    shuffle: {
      fn: (s) => shuffle(s as string, random),
      argTypes: ["string"],
    },
  };
}
