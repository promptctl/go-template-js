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
  // [LAW:single-enforcer] Dict slots declare "dict" so the gate enforces
  // plain-object-ness once. Bodies trust the param type and drop the
  // `(d && typeof d === "object" && !(d instanceof Map))` guards that
  // previously duplicated the check across 11 funcs.
  //
  // `dict` (constructor) uses argTypePattern: "alternating" so the
  // gate validates the kv cycle (string at every even index, value at
  // every odd index) — otherwise the body would re-validate every key
  // beyond the first, splitting [LAW:single-enforcer] in two.
  //
  // Receivers are typed `Record<string, unknown>` in the bodies; the
  // `as unknown[]` casts at registration are erased once the gate has
  // narrowed the runtime type.
  return {
    dict: {
      fn: (...kv) => dict(...kv),
      argTypes: ["string", "value"],
      argTypePattern: "alternating",
    },
    get: {
      fn: (d, k) => get(d as Record<string, unknown>, k as string),
      argTypes: ["dict", "string"],
    },
    set: {
      fn: (d, k, v) => set(d as Record<string, unknown>, k as string, v),
      argTypes: ["dict", "string", "value"],
    },
    unset: {
      fn: (d, k) => unset(d as Record<string, unknown>, k as string),
      argTypes: ["dict", "string"],
    },
    keys: { fn: (d) => keys(d as Record<string, unknown>), argTypes: ["dict"] },
    values: { fn: (d) => values(d as Record<string, unknown>), argTypes: ["dict"] },
    pluck: {
      fn: (k, ...d) => pluck(k as string, ...(d as Record<string, unknown>[])),
      argTypes: ["string", "dict"],
    },
    pick: {
      fn: (d, ...k) => pick(d as Record<string, unknown>, ...(k as string[])),
      argTypes: ["dict", "string"],
    },
    omit: {
      fn: (d, ...k) => omit(d as Record<string, unknown>, ...(k as string[])),
      argTypes: ["dict", "string"],
    },
    hasKey: {
      fn: (d, k) => hasKey(d as Record<string, unknown>, k as string),
      argTypes: ["dict", "string"],
    },
    merge: {
      fn: (d, ...s) => merge(d as Record<string, unknown>, ...(s as Record<string, unknown>[])),
      argTypes: ["dict"],
    },
    mergeOverwrite: {
      fn: (d, ...s) =>
        mergeOverwrite(d as Record<string, unknown>, ...(s as Record<string, unknown>[])),
      argTypes: ["dict"],
    },
  };
}
