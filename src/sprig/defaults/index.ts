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
  return {
    default: { fn: (a, b) => defaultFn(a, b), argTypes: ["any", "any"] },
    empty: { fn: (v) => empty(v), argTypes: ["any"] },
    coalesce: { fn: (...vs) => coalesce(...vs), argTypes: ["any"] },
    ternary: { fn: (a, b, c) => ternary(a, b, c), argTypes: ["any", "any", "any"] },
    fromJson: { fn: (s) => fromJson(s), argTypes: ["string"] },
    toJson: { fn: (v) => toJson(v), argTypes: ["any"], returnType: "string" },
    toPrettyJson: { fn: (v) => toPrettyJson(v), argTypes: ["any"], returnType: "string" },
  };
}
