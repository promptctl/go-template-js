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
  // [LAW:single-enforcer] List APIs are inherently T-typed (lists hold
  // arbitrary T values), so most slots stay "any". The two slots that
  // genuinely accept only numbers — chunk's size and slice's i/j —
  // tighten to "number".
  return {
    list: { fn: (...a) => list(...a), argTypes: ["any"] },
    first: { fn: (l) => first(l), argTypes: ["any"] },
    last: { fn: (l) => last(l), argTypes: ["any"] },
    rest: { fn: (l) => rest(l), argTypes: ["any"] },
    initial: { fn: (l) => initial(l), argTypes: ["any"] },
    len: { fn: (l) => len(l), argTypes: ["any"] },
    reverse: { fn: (l) => reverse(l), argTypes: ["any"] },
    uniq: { fn: (l) => uniq(l), argTypes: ["any"] },
    without: { fn: (l, ...e) => without(l, ...e), argTypes: ["any"] },
    has: { fn: (i, l) => has(i, l), argTypes: ["any", "any"] },
    compact: { fn: (l) => compact(l), argTypes: ["any"] },
    slice: {
      fn: (l, i, j) => slice(l, i as number | bigint, j as number | bigint),
      argTypes: ["any", "number", "number"],
    },
    concat: { fn: (...l) => concat(...l), argTypes: ["any"] },
    chunk: {
      fn: (s, l) => chunk(s as number | bigint, l),
      argTypes: ["number", "any"],
    },
    prepend: { fn: (l, i) => prepend(l, i), argTypes: ["any", "any"] },
    append: { fn: (l, i) => append(l, i), argTypes: ["any", "any"] },
  };
}
