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
  return {
    dict: { fn: (...kv) => dict(...kv) },
    get: { fn: (d, k) => get(d, k) },
    set: { fn: (d, k, v) => set(d, k, v) },
    unset: { fn: (d, k) => unset(d, k) },
    keys: { fn: (d) => keys(d) },
    values: { fn: (d) => values(d) },
    pluck: { fn: (k, ...d) => pluck(k, ...d) },
    pick: { fn: (d, ...k) => pick(d, ...k) },
    omit: { fn: (d, ...k) => omit(d, ...k) },
    hasKey: { fn: (d, k) => hasKey(d, k) },
    merge: { fn: (d, ...s) => merge(d, ...s) },
    mergeOverwrite: { fn: (d, ...s) => mergeOverwrite(d, ...s) },
  };
}
