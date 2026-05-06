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
  // [LAW:single-enforcer] All registrations declare argTypes; ["any"]
  // is the .2 placeholder — .3 tightens to ["number"] / ["number","number"].
  return {
    add: { fn: (...a) => add(...a), argTypes: ["any"] },
    sub: { fn: (a, b) => sub(a, b), argTypes: ["any", "any"] },
    mul: { fn: (...a) => mul(...a), argTypes: ["any"] },
    div: { fn: (a, b) => div(a, b), argTypes: ["any", "any"] },
    mod: { fn: (a, b) => mod(a, b), argTypes: ["any", "any"] },
    min: { fn: (...a) => min(...a), argTypes: ["any"] },
    max: { fn: (...a) => max(...a), argTypes: ["any"] },
    floor: { fn: (a) => floor(a), argTypes: ["any"] },
    ceil: { fn: (a) => ceil(a), argTypes: ["any"] },
    round: { fn: (a, p) => round(a, p), argTypes: ["any", "any"] },
    addf: { fn: (...a) => addf(...a), argTypes: ["any"] },
    subf: { fn: (a, b) => subf(a, b), argTypes: ["any", "any"] },
    mulf: { fn: (...a) => mulf(...a), argTypes: ["any"] },
    divf: { fn: (a, b) => divf(a, b), argTypes: ["any", "any"] },
  };
}
