/**
 * `kebabcase s` — port of `xstrings.ToKebabCase`. Identical to
 * `snakecase` except the connector is `-`.
 */

// [LAW:one-source-of-truth] The state machine lives in caseUtils;
// kebabcase is the `-` specialization.
import { camelCaseToLowerCase } from "./caseUtils.js";

export function kebabcase(s: string): string {
  return camelCaseToLowerCase(s, "-");
}
