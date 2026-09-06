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

export { atoi, float64, int, int64, toDecimal, toRawJson };

export function sprigConversions(): FuncMap {
  // [LAW:one-source-of-truth] Slot kinds come straight from the epic
  // spec (template-sprig-ctz.1):
  //  - "string"       — atoi/toDecimal: parse-from-string
  //  - "value"        — int/int64/float64: heterogeneous-by-
  //                     intent; the body is the per-kind dispatch
  //                     [LAW:dataflow-not-control-flow]
  //  - "serializable" — toRawJson: gate rejects functions/symbols/
  //                     circular refs so the body never silently
  //                     emits "null"
  const map: FuncMap = {
    atoi: { fn: (s) => atoi(s as string), argTypes: ["string"], returnType: "int" },
    int: { fn: (v) => int(v), argTypes: ["value"], returnType: "int" },
    int64: { fn: (v) => int64(v), argTypes: ["value"] },
    float64: { fn: (v) => float64(v), argTypes: ["value"], returnType: "float" },
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
