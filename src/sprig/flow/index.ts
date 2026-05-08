/**
 * Sprig flow-control functions — `fail`.
 *
 * [LAW:single-enforcer] One module owns the FuncMap registration.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { fail } from "./fail.js";

export { fail };

export function sprigFlow(): FuncMap {
  return {
    fail: { fn: (msg) => fail(msg as string), argTypes: ["string"] },
  };
}
