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
  return {
    add: { fn: (...a) => add(...a) },
    sub: { fn: (a, b) => sub(a, b) },
    mul: { fn: (...a) => mul(...a) },
    div: { fn: (a, b) => div(a, b) },
    mod: { fn: (a, b) => mod(a, b) },
    min: { fn: (...a) => min(...a) },
    max: { fn: (...a) => max(...a) },
    floor: { fn: (a) => floor(a) },
    ceil: { fn: (a) => ceil(a) },
    round: { fn: (a, p) => round(a, p) },
    addf: { fn: (...a) => addf(...a) },
    subf: { fn: (a, b) => subf(a, b) },
    mulf: { fn: (...a) => mulf(...a) },
    divf: { fn: (a, b) => divf(a, b) },
  };
}
