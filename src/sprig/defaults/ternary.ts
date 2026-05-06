/**
 * `ternary trueVal falseVal cond` — returns `trueVal` if `cond` is
 * truthy, else `falseVal`.
 *
 * Note: argument order matches Go sprig and surprises newcomers.
 * Pipelines feed cond as the trailing arg, e.g.
 *   `{{ .ok | ternary "YES" "NO" }}` → ternary("YES", "NO", .ok)
 */

import { isTruthy } from "../../evaluator/truthy.js";

export function ternary(trueVal: unknown, falseVal: unknown, cond: unknown): unknown {
  return isTruthy(cond) ? trueVal : falseVal;
}
