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
  return {
    abbrev: { fn: (w, s) => abbrev(w, s) },
    abbrevboth: { fn: (l, r, s) => abbrevboth(l, r, s) },
    cat: { fn: (...a) => cat(...a) },
    contains: { fn: (sub, s) => contains(sub, s) },
    hasPrefix: { fn: (p, s) => hasPrefix(p, s) },
    hasSuffix: { fn: (sf, s) => hasSuffix(sf, s) },
    indent: { fn: (n, s) => indent(n, s) },
    initials: { fn: (s) => initials(s) },
    join: { fn: (sep, list) => join(sep, list) },
    lower: { fn: (s) => lower(s) },
    nindent: { fn: (n, s) => nindent(n, s) },
    quote: { fn: (...a) => quote(...a) },
    repeat: { fn: (n, s) => repeat(n, s) },
    replace: { fn: (o, n, s) => replace(o, n, s) },
    split: { fn: (sep, s) => split(sep, s) },
    splitList: { fn: (sep, s) => splitList(sep, s) },
    squote: { fn: (...a) => squote(...a) },
    substr: { fn: (i, j, s) => substr(i, j, s) },
    title: { fn: (s) => title(s) },
    trim: { fn: (s) => trim(s) },
    trimAll: { fn: (cs, s) => trimAll(cs, s) },
    trimPrefix: { fn: (p, s) => trimPrefix(p, s) },
    trimSuffix: { fn: (sf, s) => trimSuffix(sf, s) },
    trunc: { fn: (n, s) => trunc(n, s) },
    untitle: { fn: (s) => untitle(s) },
    upper: { fn: (s) => upper(s) },
    wrap: { fn: (w, s) => wrap(w, s) },
    wrapWith: { fn: (w, sep, s) => wrapWith(w, sep, s) },
  };
}
