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
  return {
    kindOf: { fn: (v) => kindOf(v) },
    kindIs: { fn: (k, v) => kindIs(k, v) },
    typeOf: { fn: (v) => typeOf(v) },
    typeIs: { fn: (t, v) => typeIs(t, v) },
    typeIsLike: { fn: (t, v) => typeIsLike(t, v) },
    deepEqual: { fn: (a, b) => deepEqual(a, b) },
    deepCopy: { fn: (v) => deepCopy(v) },
  };
}
