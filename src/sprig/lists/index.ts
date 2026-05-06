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
  return {
    list: { fn: (...a) => list(...a) },
    first: { fn: (l) => first(l) },
    last: { fn: (l) => last(l) },
    rest: { fn: (l) => rest(l) },
    initial: { fn: (l) => initial(l) },
    len: { fn: (l) => len(l) },
    reverse: { fn: (l) => reverse(l) },
    uniq: { fn: (l) => uniq(l) },
    without: { fn: (l, ...e) => without(l, ...e) },
    has: { fn: (i, l) => has(i, l) },
    compact: { fn: (l) => compact(l) },
    slice: { fn: (l, i, j) => slice(l, i, j) },
    concat: { fn: (...l) => concat(...l) },
    chunk: { fn: (s, l) => chunk(s, l) },
    prepend: { fn: (l, i) => prepend(l, i) },
    append: { fn: (l, i) => append(l, i) },
  };
}
