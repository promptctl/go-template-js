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
    list: {
      fn: (...a) => list(...a),
      argTypes: ["value"],
      arity: { kind: "variadic" },
    },
    first: { fn: (l) => first(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    last: { fn: (l) => last(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    rest: { fn: (l) => rest(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    initial: { fn: (l) => initial(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    len: { fn: (l) => len(l), argTypes: ["sized"], arity: { kind: "exact" } },
    reverse: { fn: (l) => reverse(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    uniq: { fn: (l) => uniq(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    without: {
      fn: (l, ...e) => without(l as unknown[], ...e),
      argTypes: ["list", "value"],
      arity: { kind: "variadic" },
    },
    has: {
      fn: (i, l) => has(i, l as unknown[]),
      argTypes: ["value", "list"],
      arity: { kind: "exact" },
    },
    compact: { fn: (l) => compact(l as unknown[]), argTypes: ["list"], arity: { kind: "exact" } },
    // Go: `slice(list interface{}, indices ...interface{})` — one
    // required list and any number of indices, so `slice .l 1` and
    // `slice .l` are both legal. Declaring three fixed slots would
    // reject them once .49n gates the count, inventing a divergence.
    // The repeating "int" slot covers both indices.
    slice: {
      fn: (l, i, j) => slice(l as unknown[], i as number | undefined, j as number | undefined),
      argTypes: ["list", "int"],
      arity: { kind: "variadic" },
    },
    concat: {
      fn: (...l) => concat(...(l as unknown[][])),
      argTypes: ["list"],
      arity: { kind: "variadic" },
    },
    chunk: {
      fn: (s, l) => chunk(s as number, l as unknown[]),
      argTypes: ["int", "list"],
      arity: { kind: "exact" },
    },
    prepend: {
      fn: (l, i) => prepend(l as unknown[], i),
      argTypes: ["list", "value"],
      arity: { kind: "exact" },
    },
    append: {
      fn: (l, i) => append(l as unknown[], i),
      argTypes: ["list", "value"],
      arity: { kind: "exact" },
    },
    sortAlpha: {
      fn: (l) => sortAlpha(l as unknown[]),
      argTypes: ["list"],
      arity: { kind: "exact" },
      returnType: "list",
    },
    // [LAW:one-source-of-truth] `push` is Go sprig's deprecated alias for
    // `append`. Registered directly against the same closure so divergence
    // is impossible — same pattern as `biggest`→`max` in sprigMath.
    push: {
      fn: (l, i) => append(l as unknown[], i),
      argTypes: ["list", "value"],
      arity: { kind: "exact" },
    },
    // [LAW:one-source-of-truth] `tuple` is Go sprig's alias for `list`.
    tuple: {
      fn: (...a) => list(...a),
      argTypes: ["value"],
      arity: { kind: "variadic" },
    },
    // [LAW:single-enforcer] exception: `dig`'s "...keys, default, dict"
    // shape is positional from the *end* — the gate's positional-from-the-
    // start + trailing-repeat model can't express it. Body-side validation
    // surfaces failures via `bodyTypeMismatch` so call-site pos is preserved.
    // Go: `dig(ps ...interface{})` — the arity gate requires nothing.
    // Sprig's own "dig needs at least three arguments" is a body-side
    // panic, not an arity error, and `dig`'s body already reproduces it.
    // Declaring a minimum of 3 here would move that failure to the gate
    // and change its message away from Go's.
    dig: {
      fn: (...a) => dig(...a),
      argTypes: ["value"],
      arity: { kind: "variadic" },
    },
    all: {
      fn: (...a) => all(...a),
      argTypes: ["truthy"],
      arity: { kind: "variadic" },
      returnType: "bool",
    },
    any: {
      fn: (...a) => any(...a),
      argTypes: ["truthy"],
      arity: { kind: "variadic" },
      returnType: "bool",
    },
  };
}
