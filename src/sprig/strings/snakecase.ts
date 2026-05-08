/**
 * `snakecase s` — port of `xstrings.ToSnakeCase`. Inserts `_` between
 * camelCase/PascalCase word boundaries and rewrites any space, dash,
 * or underscore run into a single `_`. Runs of upper-case letters
 * release their last character into the next word, so `HTTPServer`
 * becomes `http_server`, not `https_erver`.
 */

// [LAW:one-source-of-truth] The state machine lives in caseUtils;
// snakecase is the `_` specialization.
import { camelCaseToLowerCase } from "./caseUtils.js";

export function snakecase(s: string): string {
  return camelCaseToLowerCase(s, "_");
}
