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
    add1: { fn: (n) => add1(n as number | bigint), argTypes: ["number"] },
    add1f: { fn: (n) => add1f(n as number | bigint), argTypes: ["number"] },
    maxf: { fn: (...a) => maxf(...(a as (number | bigint)[])), argTypes: ["number"] },
    minf: { fn: (...a) => minf(...(a as (number | bigint)[])), argTypes: ["number"] },
    // `biggest` is Go sprig's deprecated alias for `max`. Registered
    // directly against the same function so divergence is impossible.
    biggest: { fn: (...a) => max(...(a as (number | bigint)[])), argTypes: ["number"] },
    seq: {
      fn: (...a) => seq(...(a as (number | bigint)[])),
      argTypes: ["number"],
      returnType: "string",
    },
    until: { fn: (n) => until(n as number | bigint), argTypes: ["number"], returnType: "list" },
    untilStep: {
      fn: (a, b, c) => untilStep(a as number | bigint, b as number | bigint, c as number | bigint),
      argTypes: ["number", "number", "number"],
      returnType: "list",
    },
  };
}
