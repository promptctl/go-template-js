/** Sprig type/reflection utilities. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { deepCopy } from "./deepCopy.js";
import { deepEqual } from "./deepEqual.js";
import { kindIs } from "./kindIs.js";
import { kindOf } from "./kindOf.js";
import { typeIs } from "./typeIs.js";
import { typeIsLike } from "./typeIsLike.js";
import { typeOf } from "./typeOf.js";

export { deepCopy, deepEqual, kindIs, kindOf, typeIs, typeIsLike, typeOf };

export function sprigTypes(): FuncMap {
  // [LAW:single-enforcer] Reflection funcs accept any value, but the
  // *kind/type name* arguments tighten to "string" — they exist to be
  // compared against typeOf's string output.
  return {
    kindOf: { fn: (v) => kindOf(v), argTypes: ["any"] },
    kindIs: { fn: (k, v) => kindIs(k as string, v), argTypes: ["string", "any"] },
    typeOf: { fn: (v) => typeOf(v), argTypes: ["any"] },
    typeIs: { fn: (t, v) => typeIs(t as string, v), argTypes: ["string", "any"] },
    typeIsLike: { fn: (t, v) => typeIsLike(t as string, v), argTypes: ["string", "any"] },
    deepEqual: { fn: (a, b) => deepEqual(a, b), argTypes: ["any", "any"] },
    deepCopy: { fn: (v) => deepCopy(v), argTypes: ["any"] },
  };
}
