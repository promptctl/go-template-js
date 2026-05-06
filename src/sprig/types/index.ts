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
  // [LAW:single-enforcer] All registrations declare argTypes; ["any"]
  // matches the reflection nature of these funcs and largely stays
  // ["any"] after .3 tightens.
  return {
    kindOf: { fn: (v) => kindOf(v), argTypes: ["any"] },
    kindIs: { fn: (k, v) => kindIs(k, v), argTypes: ["any", "any"] },
    typeOf: { fn: (v) => typeOf(v), argTypes: ["any"] },
    typeIs: { fn: (t, v) => typeIs(t, v), argTypes: ["any", "any"] },
    typeIsLike: { fn: (t, v) => typeIsLike(t, v), argTypes: ["any", "any"] },
    deepEqual: { fn: (a, b) => deepEqual(a, b), argTypes: ["any", "any"] },
    deepCopy: { fn: (v) => deepCopy(v), argTypes: ["any"] },
  };
}
