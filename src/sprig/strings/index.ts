/**
 * Sprig string utilities.
 *
 * Each function lives in its own file with a co-located unit test.
 * `sprigStrings()` bundles them as a FuncMap for one-line consumer
 * registration on the engine.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { abbrev } from "./abbrev.js";
import { abbrevboth } from "./abbrevboth.js";
import { cat } from "./cat.js";
import { contains } from "./contains.js";
import { hasPrefix } from "./hasPrefix.js";
import { hasSuffix } from "./hasSuffix.js";
import { indent } from "./indent.js";
import { initials } from "./initials.js";
import { join } from "./join.js";
import { lower } from "./lower.js";
import { nindent } from "./nindent.js";
import { quote } from "./quote.js";
import { repeat } from "./repeat.js";
import { replace } from "./replace.js";
import { split } from "./split.js";
import { splitList } from "./splitList.js";
import { squote } from "./squote.js";
import { substr } from "./substr.js";
import { title } from "./title.js";
import { trim } from "./trim.js";
import { trimAll } from "./trimAll.js";
import { trimPrefix } from "./trimPrefix.js";
import { trimSuffix } from "./trimSuffix.js";
import { trunc } from "./trunc.js";
import { untitle } from "./untitle.js";
import { upper } from "./upper.js";
import { wrap } from "./wrap.js";
import { wrapWith } from "./wrapWith.js";

export {
  abbrev,
  abbrevboth,
  cat,
  contains,
  hasPrefix,
  hasSuffix,
  indent,
  initials,
  join,
  lower,
  nindent,
  quote,
  repeat,
  replace,
  split,
  splitList,
  squote,
  substr,
  title,
  trim,
  trimAll,
  trimPrefix,
  trimSuffix,
  trunc,
  untitle,
  upper,
  wrap,
  wrapWith,
};

export function sprigStrings(): FuncMap {
  // [LAW:single-enforcer] argTypes is the contract describing what each
  // func accepts; enforceArgTypes runs at the boundary, so the `as`
  // casts below are provably-safe — the runtime types match the
  // declared argTypes. Function bodies coerce primitives with
  // `String(.)` only after asserting the value is not a typed-T
  // object; see `join` for the nested-element case the boundary gate
  // can't describe.
  return {
    abbrev: {
      fn: (w, s) => abbrev(w as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    abbrevboth: {
      fn: (l, r, s) => abbrevboth(l as number | bigint, r as number | bigint, s as string),
      argTypes: ["number", "number", "string"],
    },
    cat: { fn: (...a) => cat(...(a as string[])), argTypes: ["string"] },
    contains: {
      fn: (sub, s) => contains(sub as string, s as string),
      argTypes: ["string", "string"],
    },
    hasPrefix: {
      fn: (p, s) => hasPrefix(p as string, s as string),
      argTypes: ["string", "string"],
    },
    hasSuffix: {
      fn: (sf, s) => hasSuffix(sf as string, s as string),
      argTypes: ["string", "string"],
    },
    indent: {
      fn: (n, s) => indent(n as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    initials: { fn: (s) => initials(s as string), argTypes: ["string"] },
    join: { fn: (sep, list) => join(sep as string, list), argTypes: ["string", "any"] },
    lower: { fn: (s) => lower(s as string), argTypes: ["string"] },
    nindent: {
      fn: (n, s) => nindent(n as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    quote: { fn: (...a) => quote(...(a as string[])), argTypes: ["string"] },
    repeat: {
      fn: (n, s) => repeat(n as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    replace: {
      fn: (o, n, s) => replace(o as string, n as string, s as string),
      argTypes: ["string", "string", "string"],
    },
    split: { fn: (sep, s) => split(sep as string, s as string), argTypes: ["string", "string"] },
    splitList: {
      fn: (sep, s) => splitList(sep as string, s as string),
      argTypes: ["string", "string"],
    },
    squote: { fn: (...a) => squote(...(a as string[])), argTypes: ["string"] },
    substr: {
      fn: (i, j, s) => substr(i as number | bigint, j as number | bigint, s as string),
      argTypes: ["number", "number", "string"],
    },
    title: { fn: (s) => title(s as string), argTypes: ["string"] },
    trim: { fn: (s) => trim(s as string), argTypes: ["string"] },
    trimAll: {
      fn: (cs, s) => trimAll(cs as string, s as string),
      argTypes: ["string", "string"],
    },
    trimPrefix: {
      fn: (p, s) => trimPrefix(p as string, s as string),
      argTypes: ["string", "string"],
    },
    trimSuffix: {
      fn: (sf, s) => trimSuffix(sf as string, s as string),
      argTypes: ["string", "string"],
    },
    trunc: {
      fn: (n, s) => trunc(n as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    untitle: { fn: (s) => untitle(s as string), argTypes: ["string"] },
    upper: { fn: (s) => upper(s as string), argTypes: ["string"] },
    wrap: {
      fn: (w, s) => wrap(w as number | bigint, s as string),
      argTypes: ["number", "string"],
    },
    wrapWith: {
      fn: (w, sep, s) => wrapWith(w as number | bigint, sep as string, s as string),
      argTypes: ["number", "string", "string"],
    },
  };
}
