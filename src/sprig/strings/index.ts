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
  // [LAW:single-enforcer] Every registration declares argTypes — the
  // no-silent-flatten guard is unconditional. ["any"] is the explicit
  // permissive escape; the .3 follow-up tightens these to the actual
  // declared types of each function (e.g. ["string"] for upper/trim).
  return {
    abbrev: { fn: (w, s) => abbrev(w, s), argTypes: ["any", "any"] },
    abbrevboth: { fn: (l, r, s) => abbrevboth(l, r, s), argTypes: ["any", "any", "any"] },
    cat: { fn: (...a) => cat(...a), argTypes: ["any"] },
    contains: { fn: (sub, s) => contains(sub, s), argTypes: ["any", "any"] },
    hasPrefix: { fn: (p, s) => hasPrefix(p, s), argTypes: ["any", "any"] },
    hasSuffix: { fn: (sf, s) => hasSuffix(sf, s), argTypes: ["any", "any"] },
    indent: { fn: (n, s) => indent(n, s), argTypes: ["any", "any"] },
    initials: { fn: (s) => initials(s), argTypes: ["any"] },
    join: { fn: (sep, list) => join(sep, list), argTypes: ["any", "any"] },
    lower: { fn: (s) => lower(s), argTypes: ["any"] },
    nindent: { fn: (n, s) => nindent(n, s), argTypes: ["any", "any"] },
    quote: { fn: (...a) => quote(...a), argTypes: ["any"] },
    repeat: { fn: (n, s) => repeat(n, s), argTypes: ["any", "any"] },
    replace: { fn: (o, n, s) => replace(o, n, s), argTypes: ["any", "any", "any"] },
    split: { fn: (sep, s) => split(sep, s), argTypes: ["any", "any"] },
    splitList: { fn: (sep, s) => splitList(sep, s), argTypes: ["any", "any"] },
    squote: { fn: (...a) => squote(...a), argTypes: ["any"] },
    substr: { fn: (i, j, s) => substr(i, j, s), argTypes: ["any", "any", "any"] },
    title: { fn: (s) => title(s), argTypes: ["any"] },
    trim: { fn: (s) => trim(s), argTypes: ["any"] },
    trimAll: { fn: (cs, s) => trimAll(cs, s), argTypes: ["any", "any"] },
    trimPrefix: { fn: (p, s) => trimPrefix(p, s), argTypes: ["any", "any"] },
    trimSuffix: { fn: (sf, s) => trimSuffix(sf, s), argTypes: ["any", "any"] },
    trunc: { fn: (n, s) => trunc(n, s), argTypes: ["any", "any"] },
    untitle: { fn: (s) => untitle(s), argTypes: ["any"] },
    upper: { fn: (s) => upper(s), argTypes: ["any"] },
    wrap: { fn: (w, s) => wrap(w, s), argTypes: ["any", "any"] },
    wrapWith: { fn: (w, sep, s) => wrapWith(w, sep, s), argTypes: ["any", "any", "any"] },
  };
}
