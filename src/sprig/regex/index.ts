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
  // [LAW:single-enforcer] All registrations declare argTypes; ["any"]
  // is the .2 placeholder — .3 tightens to ["string", "string"] etc.
  return {
    regexMatch: { fn: (p, s) => regexMatch(p, s), argTypes: ["any", "any"] },
    regexFind: { fn: (p, s) => regexFind(p, s), argTypes: ["any", "any"] },
    regexFindAll: { fn: (p, s, n) => regexFindAll(p, s, n), argTypes: ["any", "any", "any"] },
    regexReplaceAll: {
      fn: (p, s, r) => regexReplaceAll(p, s, r),
      argTypes: ["any", "any", "any"],
    },
    regexReplaceAllLiteral: {
      fn: (p, s, r) => regexReplaceAllLiteral(p, s, r),
      argTypes: ["any", "any", "any"],
    },
    regexSplit: { fn: (p, s, n) => regexSplit(p, s, n), argTypes: ["any", "any", "any"] },
  };
}
