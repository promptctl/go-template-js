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
  // [LAW:one-source-of-truth] Reflection slots declare "reflective"
  // (intent: type-inspection context); structural-clone/compare slots
  // declare "value" (intent: genuinely heterogeneous). The *kind/type
  // name* arguments stay "string" — they exist to be compared against
  // typeOf's string output.
  return {
    kindOf: { fn: (v) => kindOf(v), argTypes: ["reflective"] },
    kindIs: { fn: (k, v) => kindIs(k as string, v), argTypes: ["string", "reflective"] },
    typeOf: { fn: (v) => typeOf(v), argTypes: ["reflective"] },
    typeIs: { fn: (t, v) => typeIs(t as string, v), argTypes: ["string", "reflective"] },
    typeIsLike: { fn: (t, v) => typeIsLike(t as string, v), argTypes: ["string", "reflective"] },
    deepEqual: { fn: (a, b) => deepEqual(a, b), argTypes: ["value", "value"] },
    deepCopy: { fn: (v) => deepCopy(v), argTypes: ["value"] },
  };
}
