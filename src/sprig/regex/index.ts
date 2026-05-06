/**
 * Sprig regex utilities.
 *
 * Important divergence from Go sprig: these use **JS regex semantics**
 * (ECMAScript), not Go's RE2. Most patterns work identically; the
 * notable differences are lookbehind syntax and Unicode property
 * escapes. Document the divergence in the README when it lands.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { regexFind } from "./regexFind.js";
import { regexFindAll } from "./regexFindAll.js";
import { regexMatch } from "./regexMatch.js";
import { regexReplaceAll } from "./regexReplaceAll.js";
import { regexReplaceAllLiteral } from "./regexReplaceAllLiteral.js";
import { regexSplit } from "./regexSplit.js";

export { regexFind, regexFindAll, regexMatch, regexReplaceAll, regexReplaceAllLiteral, regexSplit };

export function sprigRegex(): FuncMap {
  // [LAW:single-enforcer] argTypes is the *one* contract describing
  // what each func accepts. enforceArgTypes catches T flowing into a
  // string slot at the boundary, so the bodies trust their declared
  // types and no longer call `String(.)`.
  return {
    regexMatch: {
      fn: (p, s) => regexMatch(p as string, s as string),
      argTypes: ["string", "string"],
    },
    regexFind: {
      fn: (p, s) => regexFind(p as string, s as string),
      argTypes: ["string", "string"],
    },
    regexFindAll: {
      fn: (p, s, n) => regexFindAll(p as string, s as string, n as number | bigint),
      argTypes: ["string", "string", "number"],
    },
    regexReplaceAll: {
      fn: (p, s, r) => regexReplaceAll(p as string, s as string, r as string),
      argTypes: ["string", "string", "string"],
    },
    regexReplaceAllLiteral: {
      fn: (p, s, r) => regexReplaceAllLiteral(p as string, s as string, r as string),
      argTypes: ["string", "string", "string"],
    },
    regexSplit: {
      fn: (p, s, n) => regexSplit(p as string, s as string, n as number | bigint),
      argTypes: ["string", "string", "number"],
    },
  };
}
