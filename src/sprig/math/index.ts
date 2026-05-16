/** Sprig math utilities — int and float arithmetic. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { add } from "./add.js";
import { add1 } from "./add1.js";
import { add1f } from "./add1f.js";
import { addf } from "./addf.js";
import { ceil } from "./ceil.js";
import { div } from "./div.js";
import { divf } from "./divf.js";
import { floor } from "./floor.js";
import { max } from "./max.js";
import { maxf } from "./maxf.js";
import { min } from "./min.js";
import { minf } from "./minf.js";
import { mod } from "./mod.js";
import { mul } from "./mul.js";
import { mulf } from "./mulf.js";
import { round } from "./round.js";
import { seq } from "./seq.js";
import { sub } from "./sub.js";
import { subf } from "./subf.js";
import { until } from "./until.js";
import { untilStep } from "./untilStep.js";

export {
  add,
  add1,
  add1f,
  addf,
  ceil,
  div,
  divf,
  floor,
  max,
  maxf,
  min,
  minf,
  mod,
  mul,
  mulf,
  round,
  seq,
  sub,
  subf,
  until,
  untilStep,
};

export function sprigMath(): FuncMap {
  // [LAW:single-enforcer] enforceArgTypes normalizes "int"/"float" slots
  // to plain `number` before dispatch — "int" arrives truncated toward zero
  // (Go int64 semantics); "float" arrives coerced (IEEE-754 semantics).
  // Bodies receive `number`, never `bigint`.
  return {
    add: { fn: (...a) => add(...(a as number[])), argTypes: ["int"] },
    sub: { fn: (a, b) => sub(a as number, b as number), argTypes: ["int", "int"] },
    mul: { fn: (...a) => mul(...(a as number[])), argTypes: ["int"] },
    div: { fn: (a, b) => div(a as number, b as number), argTypes: ["int", "int"] },
    mod: { fn: (a, b) => mod(a as number, b as number), argTypes: ["int", "int"] },
    min: { fn: (...a) => min(...(a as number[])), argTypes: ["int"] },
    max: { fn: (...a) => max(...(a as number[])), argTypes: ["int"] },
    floor: { fn: (a) => floor(a as number), argTypes: ["float"] },
    ceil: { fn: (a) => ceil(a as number), argTypes: ["float"] },
    round: { fn: (a, p) => round(a as number, p as number), argTypes: ["float", "int"] },
    addf: { fn: (...a) => addf(...(a as number[])), argTypes: ["float"] },
    subf: { fn: (a, b) => subf(a as number, b as number), argTypes: ["float", "float"] },
    mulf: { fn: (...a) => mulf(...(a as number[])), argTypes: ["float"] },
    divf: { fn: (a, b) => divf(a as number, b as number), argTypes: ["float", "float"] },
    add1: { fn: (n) => add1(n as number), argTypes: ["int"] },
    add1f: { fn: (n) => add1f(n as number), argTypes: ["float"] },
    maxf: { fn: (...a) => maxf(...(a as number[])), argTypes: ["float"] },
    minf: { fn: (...a) => minf(...(a as number[])), argTypes: ["float"] },
    // `biggest` is Go sprig's deprecated alias for `max`. Registered
    // directly against the same function so divergence is impossible.
    biggest: { fn: (...a) => max(...(a as number[])), argTypes: ["int"] },
    seq: {
      fn: (...a) => seq(...(a as number[])),
      argTypes: ["int"],
      returnType: "string",
    },
    until: { fn: (n) => until(n as number), argTypes: ["int"], returnType: "list" },
    untilStep: {
      fn: (a, b, c) => untilStep(a as number, b as number, c as number),
      argTypes: ["int", "int", "int"],
      returnType: "list",
    },
  };
}
