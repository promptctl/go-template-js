/** Sprig list utilities — pair-files per epic spec. */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { append } from "./append.js";
import { chunk } from "./chunk.js";
import { compact } from "./compact.js";
import { concat } from "./concat.js";
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
import { uniq } from "./uniq.js";
import { without } from "./without.js";

export {
  append,
  chunk,
  compact,
  concat,
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
  // gate. `list` (constructor) keeps "any" — migrated by
  // template-laws-3gt.8 (intent-named kinds).
  return {
    list: { fn: (...a) => list(...a), argTypes: ["any"] },
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
  };
}
