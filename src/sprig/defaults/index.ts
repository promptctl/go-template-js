/**
 * Sprig defaults — `default`, `empty`, `coalesce`, `ternary`, JSON.
 *
 * [LAW:single-enforcer] One module owns the FuncMap registration for
 * this category. Consumers either import individual functions or
 * spread the whole map via `sprigDefaults()` into their EngineConfig.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { coalesce } from "./coalesce.js";
import { defaultFn } from "./default.js";
import { empty } from "./empty.js";
import { fromJson } from "./fromJson.js";
import { ternary } from "./ternary.js";
import { toJson } from "./toJson.js";
import { toPrettyJson } from "./toPrettyJson.js";

export { coalesce, defaultFn, empty, fromJson, ternary, toJson, toPrettyJson };

export function sprigDefaults(): FuncMap {
  // [LAW:one-source-of-truth] Intent-named slots replace "any" so the
  // label tells the reader why each slot accepts anything:
  //  - "value"        — heterogeneous slot (constructor / pass-through)
  //  - "truthy"       — value is consulted for emptiness/truthiness
  //  - "serializable" — value is about to be JSON-encoded; the gate
  //                     rejects functions, symbols, and circular refs
  //                     so toJson/toPrettyJson never silently emit
  //                     "null" or throw deep inside the body.
  return {
    // Go: `dfault(d interface{}, given ...interface{})` — the value to
    // test is variadic, so `default "fallback"` with nothing to test is
    // a legal call that yields the fallback.
    default: {
      fn: (a, b) => defaultFn(a, b),
      argTypes: ["value", "truthy"],
      arity: { kind: "variadic" },
    },
    empty: { fn: (v) => empty(v), argTypes: ["truthy"], arity: { kind: "exact" } },
    coalesce: {
      fn: (...vs) => coalesce(...vs),
      argTypes: ["truthy"],
      arity: { kind: "variadic" },
    },
    ternary: {
      fn: (a, b, c) => ternary(a, b, c),
      argTypes: ["value", "value", "truthy"],
      arity: { kind: "exact" },
    },
    fromJson: { fn: (s) => fromJson(s as string), argTypes: ["string"], arity: { kind: "exact" } },
    toJson: {
      fn: (v) => toJson(v),
      argTypes: ["serializable"],
      arity: { kind: "exact" },
      returnType: "string",
    },
    toPrettyJson: {
      fn: (v) => toPrettyJson(v),
      argTypes: ["serializable"],
      arity: { kind: "exact" },
      returnType: "string",
    },
  };
}
