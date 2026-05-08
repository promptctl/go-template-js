/** Sprig list utilities — pair-files per epic spec. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { all } from "./all.js";
import { any } from "./any.js";
import { append } from "./append.js";
import { chunk } from "./chunk.js";
import { compact } from "./compact.js";
import { concat } from "./concat.js";
import { dig } from "./dig.js";
import { first } from "./first.js";
import { has } from "./has.js";
import { initial } from "./initial.js";
import { last } from "./last.js";
import { len } from "./len.js";
import { list } from "./list.js";
import { prepend } from "./prepend.js";
import { rest } from "./rest.js";
import { reverse } from "./reverse.js";
import { slice } from "./slice.js";
import { sortAlpha } from "./sortAlpha.js";
import { uniq } from "./uniq.js";
import { without } from "./without.js";

export {
  all,
  any,
  append,
  chunk,
  compact,
  concat,
  dig,
  first,
  has,
  initial,
  last,
  len,
  list,
  prepend,
  rest,
  reverse,
  slice,
  sortAlpha,
  uniq,
  without,
};

export function sprigLists(): FuncMap {
  // [LAW:single-enforcer] List slots declare "list" so the gate enforces
  // array-ness once. Bodies trust the param type and drop the defensive
  // `Array.isArray` guards that previously duplicated the check 14 times.
  // Item slots that are genuinely heterogeneous use "value" — they still
  // accept anything, but the label documents intent (per template-laws-3gt.1).
  // `len` declares "sized" (template-laws-3gt.4) — the body trusts the
  // gate. `list` (constructor) declares "value" (template-laws-3gt.8)
  // — heterogeneous-by-intent.
  return {
    list: { fn: (...a) => list(...a), argTypes: ["value"] },
    first: { fn: (l) => first(l as unknown[]), argTypes: ["list"] },
    last: { fn: (l) => last(l as unknown[]), argTypes: ["list"] },
    rest: { fn: (l) => rest(l as unknown[]), argTypes: ["list"] },
    initial: { fn: (l) => initial(l as unknown[]), argTypes: ["list"] },
    len: { fn: (l) => len(l), argTypes: ["sized"] },
    reverse: { fn: (l) => reverse(l as unknown[]), argTypes: ["list"] },
    uniq: { fn: (l) => uniq(l as unknown[]), argTypes: ["list"] },
    without: {
      fn: (l, ...e) => without(l as unknown[], ...e),
      argTypes: ["list", "value"],
    },
    has: { fn: (i, l) => has(i, l as unknown[]), argTypes: ["value", "list"] },
    compact: { fn: (l) => compact(l as unknown[]), argTypes: ["list"] },
    slice: {
      fn: (l, i, j) => slice(l as unknown[], i as number | bigint, j as number | bigint),
      argTypes: ["list", "number", "number"],
    },
    concat: { fn: (...l) => concat(...(l as unknown[][])), argTypes: ["list"] },
    chunk: {
      fn: (s, l) => chunk(s as number | bigint, l as unknown[]),
      argTypes: ["number", "list"],
    },
    prepend: {
      fn: (l, i) => prepend(l as unknown[], i),
      argTypes: ["list", "value"],
    },
    append: {
      fn: (l, i) => append(l as unknown[], i),
      argTypes: ["list", "value"],
    },
    sortAlpha: {
      fn: (l) => sortAlpha(l as unknown[]),
      argTypes: ["list"],
      returnType: "list",
    },
    // [LAW:one-source-of-truth] `push` is Go sprig's deprecated alias for
    // `append`. Registered directly against the same closure so divergence
    // is impossible — same pattern as `biggest`→`max` in sprigMath.
    push: {
      fn: (l, i) => append(l as unknown[], i),
      argTypes: ["list", "value"],
    },
    // [LAW:one-source-of-truth] `tuple` is Go sprig's alias for `list`.
    tuple: { fn: (...a) => list(...a), argTypes: ["value"] },
    // [LAW:single-enforcer] exception: `dig`'s "...keys, default, dict"
    // shape is positional from the *end* — the gate's positional-from-the-
    // start + trailing-repeat model can't express it. Body-side validation
    // surfaces failures via `bodyTypeMismatch` so call-site pos is preserved.
    dig: { fn: (...a) => dig(...a), argTypes: ["value"] },
    all: { fn: (...a) => all(...a), argTypes: ["truthy"], returnType: "bool" },
    any: { fn: (...a) => any(...a), argTypes: ["truthy"], returnType: "bool" },
  };
}
