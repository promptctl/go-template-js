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
  // [LAW:single-enforcer] All registrations declare argTypes; ["any"]
  // is the .2 placeholder — .3 tightens (e.g. dict keys to "string").
  return {
    dict: { fn: (...kv) => dict(...kv), argTypes: ["any"] },
    get: { fn: (d, k) => get(d, k), argTypes: ["any", "any"] },
    set: { fn: (d, k, v) => set(d, k, v), argTypes: ["any", "any", "any"] },
    unset: { fn: (d, k) => unset(d, k), argTypes: ["any", "any"] },
    keys: { fn: (d) => keys(d), argTypes: ["any"] },
    values: { fn: (d) => values(d), argTypes: ["any"] },
    pluck: { fn: (k, ...d) => pluck(k, ...d), argTypes: ["any"] },
    pick: { fn: (d, ...k) => pick(d, ...k), argTypes: ["any"] },
    omit: { fn: (d, ...k) => omit(d, ...k), argTypes: ["any"] },
    hasKey: { fn: (d, k) => hasKey(d, k), argTypes: ["any", "any"] },
    merge: { fn: (d, ...s) => merge(d, ...s), argTypes: ["any"] },
    mergeOverwrite: { fn: (d, ...s) => mergeOverwrite(d, ...s), argTypes: ["any"] },
  };
}
