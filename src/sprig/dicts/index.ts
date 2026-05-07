/** Sprig dict utilities — pair-files per epic spec. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { dict } from "./dict.js";
import { get } from "./get.js";
import { hasKey } from "./hasKey.js";
import { keys } from "./keys.js";
import { merge } from "./merge.js";
import { mergeOverwrite } from "./mergeOverwrite.js";
import { omit } from "./omit.js";
import { pick } from "./pick.js";
import { pluck } from "./pluck.js";
import { set } from "./set.js";
import { unset } from "./unset.js";
import { values } from "./values.js";

export { dict, get, hasKey, keys, merge, mergeOverwrite, omit, pick, pluck, set, unset, values };

export function sprigDicts(): FuncMap {
  // [LAW:single-enforcer] enforceArgTypes validates each func's
  // first-class arg types at the boundary. dict's variadic key/value
  // alternation can only describe the first key as "string" — keys at
  // index >= 2 fall to the trailing "any" slot, so dict's body
  // validates those positions and throws TypeMismatchError on
  // non-strings (re-emitted with call-site pos by evalCommand).
  return {
    dict: { fn: (...kv) => dict(...kv), argTypes: ["string", "any"] },
    get: { fn: (d, k) => get(d, k as string), argTypes: ["any", "string"] },
    set: { fn: (d, k, v) => set(d, k as string, v), argTypes: ["any", "string", "any"] },
    unset: { fn: (d, k) => unset(d, k as string), argTypes: ["any", "string"] },
    keys: { fn: (d) => keys(d), argTypes: ["any"] },
    values: { fn: (d) => values(d), argTypes: ["any"] },
    pluck: { fn: (k, ...d) => pluck(k as string, ...d), argTypes: ["string", "any"] },
    pick: { fn: (d, ...k) => pick(d, ...(k as string[])), argTypes: ["any", "string"] },
    omit: { fn: (d, ...k) => omit(d, ...(k as string[])), argTypes: ["any", "string"] },
    hasKey: { fn: (d, k) => hasKey(d, k as string), argTypes: ["any", "string"] },
    merge: { fn: (d, ...s) => merge(d, ...s), argTypes: ["any"] },
    mergeOverwrite: { fn: (d, ...s) => mergeOverwrite(d, ...s), argTypes: ["any"] },
  };
}
