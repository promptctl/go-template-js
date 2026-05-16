/**
 * Sprig conversion utilities — pair-files per epic spec.
 *
 * [LAW:single-enforcer] One module owns FuncMap registration for this
 * category. Consumers either import individual functions or spread
 * the whole map via `sprigConversions()` into their EngineConfig.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { atoi } from "./atoi.js";
import { float64 } from "./float64.js";
import { int } from "./int.js";
import { int64 } from "./int64.js";
import { toDecimal } from "./toDecimal.js";
import { toRawJson } from "./toRawJson.js";
// Renamed local bindings — `toString` as a property key in the
// returned FuncMap collides with `Object.prototype.toString`'s implicit
// type, which broke TS's contextual inference for the entry. Using
// distinct local names (`sprigToString`) inside the factory keeps the
// public func name `toString` while letting the property key stand on
// its own.
import { toString as sprigToString } from "./toString.js";
import { toStrings as sprigToStrings } from "./toStrings.js";

export {
  atoi,
  float64,
  int,
  int64,
  sprigToString as toString,
  sprigToStrings as toStrings,
  toDecimal,
  toRawJson,
};

export function sprigConversions(): FuncMap {
  // [LAW:one-source-of-truth] Slot kinds come straight from the epic
  // spec (template-sprig-ctz.1):
  //  - "string"       — atoi/toDecimal: parse-from-string
  //  - "value"        — int/int64/float64/toString: heterogeneous-by-
  //                     intent; the body is the per-kind dispatch
  //                     [LAW:dataflow-not-control-flow]
  //  - "list"         — toStrings: per-element conversion, list shape
  //                     enforced once at the gate
  //  - "serializable" — toRawJson: gate rejects functions/symbols/
  //                     circular refs so the body never silently
  //                     emits "null"
  //
  // The local-binding indirection (`const map: FuncMap = ...`) forces
  // TS to apply the FuncMap contextual type to the literal. Without it,
  // a property key named `toString` shadows `Object.prototype.toString`
  // during TS's literal-type inference, which widens `argTypes` from
  // a tuple of ArgType to `string[]` and breaks the entry.
  const map: FuncMap = {
    atoi: { fn: (s) => atoi(s as string), argTypes: ["string"], returnType: "int" },
    int: { fn: (v) => int(v), argTypes: ["value"], returnType: "int" },
    int64: { fn: (v) => int64(v), argTypes: ["value"] },
    float64: { fn: (v) => float64(v), argTypes: ["value"], returnType: "float" },
    // The `toString` key matches `Object.prototype.toString`, which
    // shadows TS's contextual typing for this single entry. Pinning
    // the literal types with `as const` (or `satisfies TemplateFunc`)
    // is the standard escape — the entry's shape is identical to its
    // siblings; only TS inference needs the hint.
    toString: {
      fn: (v: unknown) => sprigToString(v),
      argTypes: ["value"] as const,
      returnType: "string" as const,
    },
    toStrings: {
      fn: (l) => sprigToStrings(l as unknown[]),
      argTypes: ["list"],
    },
    toDecimal: {
      fn: (s) => toDecimal(s as string),
      argTypes: ["string"],
      returnType: "int",
    },
    toRawJson: {
      fn: (v) => toRawJson(v),
      argTypes: ["serializable"],
      returnType: "string",
    },
  };
  return map;
}
