/** Sprig math utilities — int and float arithmetic. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { add } from "./add.js";
import { addf } from "./addf.js";
import { ceil } from "./ceil.js";
import { div } from "./div.js";
import { divf } from "./divf.js";
import { floor } from "./floor.js";
import { max } from "./max.js";
import { min } from "./min.js";
import { mod } from "./mod.js";
import { mul } from "./mul.js";
import { mulf } from "./mulf.js";
import { round } from "./round.js";
import { sub } from "./sub.js";
import { subf } from "./subf.js";

export { add, addf, ceil, div, divf, floor, max, min, mod, mul, mulf, round, sub, subf };

export function sprigMath(): FuncMap {
  // [LAW:single-enforcer] enforceArgTypes guarantees runtime values
  // match the declared "number" type (number or bigint). The bodies'
  // remaining `Number(v)` calls are bigint→number conversions, not
  // boundary coercions — they do real arithmetic work.
  return {
    add: { fn: (...a) => add(...(a as (number | bigint)[])), argTypes: ["number"] },
    sub: {
      fn: (a, b) => sub(a as number | bigint, b as number | bigint),
      argTypes: ["number", "number"],
    },
    mul: { fn: (...a) => mul(...(a as (number | bigint)[])), argTypes: ["number"] },
    div: {
      fn: (a, b) => div(a as number | bigint, b as number | bigint),
      argTypes: ["number", "number"],
    },
    mod: {
      fn: (a, b) => mod(a as number | bigint, b as number | bigint),
      argTypes: ["number", "number"],
    },
    min: { fn: (...a) => min(...(a as (number | bigint)[])), argTypes: ["number"] },
    max: { fn: (...a) => max(...(a as (number | bigint)[])), argTypes: ["number"] },
    floor: { fn: (a) => floor(a as number | bigint), argTypes: ["number"] },
    ceil: { fn: (a) => ceil(a as number | bigint), argTypes: ["number"] },
    round: {
      fn: (a, p) => round(a as number | bigint, p as number | bigint),
      argTypes: ["number", "number"],
    },
    addf: { fn: (...a) => addf(...(a as (number | bigint)[])), argTypes: ["number"] },
    subf: {
      fn: (a, b) => subf(a as number | bigint, b as number | bigint),
      argTypes: ["number", "number"],
    },
    mulf: { fn: (...a) => mulf(...(a as (number | bigint)[])), argTypes: ["number"] },
    divf: {
      fn: (a, b) => divf(a as number | bigint, b as number | bigint),
      argTypes: ["number", "number"],
    },
  };
}
