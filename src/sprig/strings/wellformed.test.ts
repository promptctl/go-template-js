import { describe, expect, it } from "vitest";
import { abbrev } from "./abbrev.js";
import { abbrevboth } from "./abbrevboth.js";
import { camelcase } from "./camelcase.js";
import { cat } from "./cat.js";
import { contains } from "./contains.js";
import { hasPrefix } from "./hasPrefix.js";
import { hasSuffix } from "./hasSuffix.js";
import { indent } from "./indent.js";
import { sprigStrings } from "./index.js";
import { initials } from "./initials.js";
import { join } from "./join.js";
import { kebabcase } from "./kebabcase.js";
import { lower } from "./lower.js";
import { nindent } from "./nindent.js";
import { nospace } from "./nospace.js";
import { plural } from "./plural.js";
import { quote } from "./quote.js";
import { regexQuoteMeta } from "./regexQuoteMeta.js";
import { repeat } from "./repeat.js";
import { replace } from "./replace.js";
import { snakecase } from "./snakecase.js";
import { split } from "./split.js";
import { splitList } from "./splitList.js";
import { splitn } from "./splitn.js";
import { squote } from "./squote.js";
import { substr } from "./substr.js";
import { swapcase } from "./swapcase.js";
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

/**
 * The lone-surrogate net: astral input through EVERY sprig string
 * function, asserting no result contains an unpaired surrogate.
 *
 * The bug this replaces was found by hand on two functions
 * (`trunc`, `substr`) and turned out to sit in eight. Hand-listing the
 * functions to probe would repeat that: the list is a second copy of
 * "the string functions" that drifts the day a 37th is added, and the
 * new one goes unswept in silence. So the probe table below is held to
 * `sprigStrings()` — the registry is the one authoritative list
 * ([LAW:one-source-of-truth]) and a function registered without a probe
 * fails `covers every function the registry exposes` loudly
 * ([LAW:no-silent-failure]).
 *
 * The theorem is well-formed in, well-formed out. Handed an already
 * unpaired surrogate as an argument, these functions may still pass it
 * through — `trimSuffix "\ud83d" "😁"` slices a real pair at
 * a real match and hands back the lone lead. That input never occurs in
 * a well-formed program and pinning it would assert a repair behaviour
 * nothing implements.
 *
 * No conformance fixture: well-formedness is a property of THIS
 * engine's UTF-16 strings, not a Go parity claim. Go's own answers here
 * are frequently invalid UTF-8 (`trunc 1 "𐍈"` is the single byte
 * \xf0), so there is nothing to generate — see
 * `template-unicode-rin.pyx` for the measured divergence table.
 */

/** U+10348 GOTHIC LETTER HWAIR — 𐍈 in UTF-16. */
const HWAIR = "𐍈";
/** U+1F600 GRINNING FACE — 😀. */
const GRIN = "😀";
/**
 * U+1F601 BEAMING FACE — 😁, sharing GRIN's LEAD surrogate.
 * A cutset or affix test that compares half a character matches GRIN
 * against BEAM, which is how `trimAll` shears one; two unrelated astral
 * characters would not collide and the probe would pass while broken.
 */
const BEAM = "😁";

/**
 * Every registry name, called with astral input.
 *
 * Where a function takes a character position, the position is chosen
 * so that decoding by UTF-16 unit lands INSIDE a character — an odd
 * count against a 2-unit character, or the empty separator that splits
 * between them. A probe that cuts on an even boundary passes whether
 * the decode is right or wrong, and proves nothing. The remaining
 * functions take no character position and cannot shear one; they are
 * probed as pass-throughs so that the coverage assertion above can be
 * exhaustive, and the predicates (`contains`, `hasPrefix`, `hasSuffix`)
 * return no string at all, so they hold vacuously and are listed to
 * document that rather than to test it.
 */
const probes: Record<string, readonly (() => unknown)[]> = {
  // Sliced by code point — the eight that were shearing characters.
  trunc: [() => trunc(1, `${HWAIR}x`), () => trunc(-1, `x${HWAIR}`)],
  substr: [() => substr(0, 1, `${HWAIR}x`), () => substr(1, 3, `${HWAIR}${GRIN}`)],
  abbrev: [() => abbrev(4, `${HWAIR}abcdef`)],
  abbrevboth: [() => abbrevboth(1, 7, `${HWAIR}abcdef`)],
  trimAll: [() => trimAll(GRIN, `${GRIN}${BEAM}`)],
  split: [() => split("", `${HWAIR}ab`)],
  splitList: [() => splitList("", `${HWAIR}ab`)],
  splitn: [() => splitn("", 2, `${HWAIR}ab`)],
  replace: [() => replace("", "-", `${HWAIR}ab`)],

  // Affix operations: safe by construction, because the offset they
  // slice at is one a startsWith/endsWith match has already proved to
  // be a character boundary. BEAM against GRIN's lead surrogate is the
  // case that would expose a half-character compare.
  trimPrefix: [() => trimPrefix(HWAIR, `${HWAIR}x`), () => trimPrefix(GRIN, `${BEAM}x`)],
  trimSuffix: [() => trimSuffix(HWAIR, `x${HWAIR}`), () => trimSuffix(GRIN, `x${BEAM}`)],

  // Width-counted, never cut mid-word: `wrap` measures in UTF-16 units
  // and diverges from Go's bytes, but cannot emit a lone surrogate.
  // Deliberately NOT converted to runes — see template-unicode-rin.pyx.
  wrap: [() => wrap(2, `${HWAIR} ${GRIN}`)],
  wrapWith: [() => wrapWith(2, "\n", `${HWAIR} ${GRIN}`)],

  // Case mapping: already rune-correct, sharing the same decode.
  camelcase: [() => camelcase(`${HWAIR} foo`)],
  kebabcase: [() => kebabcase(`${HWAIR} foo`)],
  snakecase: [() => snakecase(`${HWAIR} foo`)],
  lower: [() => lower(`${HWAIR}A`)],
  upper: [() => upper(`${HWAIR}a`)],
  title: [() => title(`${HWAIR} foo`)],
  untitle: [() => untitle(`${HWAIR} Foo`)],
  swapcase: [() => swapcase(`${HWAIR}aB`)],
  nospace: [() => nospace(`${HWAIR} ${GRIN}`)],

  // Pass-throughs: the astral text is copied, wrapped, or concatenated.
  cat: [() => cat(HWAIR, GRIN)],
  join: [() => join("", [HWAIR, GRIN])],
  indent: [() => indent(2, HWAIR)],
  nindent: [() => nindent(2, HWAIR)],
  repeat: [() => repeat(2, HWAIR)],
  quote: [() => quote(HWAIR)],
  squote: [() => squote(HWAIR)],
  plural: [() => plural(HWAIR, GRIN, 2)],
  regexQuoteMeta: [() => regexQuoteMeta(`${HWAIR}.`)],
  trim: [() => trim(` ${HWAIR} `)],
  // `initials` takes the first BYTE of each word and reinterprets it as
  // a code point, faithfully to goutils — `"𐍈foo"` -> `"ð"` (U+00F0),
  // a whole character, so byte-faithfulness and well-formedness do not
  // conflict here.
  initials: [() => initials(`${HWAIR}foo ${GRIN}bar`)],

  // Predicates: no string in the result, so nothing to shear.
  contains: [() => contains(GRIN, `${BEAM}x`)],
  hasPrefix: [() => hasPrefix(GRIN, `${BEAM}x`)],
  hasSuffix: [() => hasSuffix(GRIN, `x${BEAM}`)],
};

/**
 * Every string reachable in a result, at any depth.
 *
 * [LAW:parse-dont-validate] Results are strings (`trunc`), arrays
 * (`splitList`), dicts (`split`) and booleans (`contains`); a total
 * walk turns any of them into the one type the assertion needs, so the
 * assertion never asks which function produced the value
 * ([LAW:dataflow-not-control-flow]).
 */
function reachableStrings(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(reachableStrings);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(reachableStrings);
  }
  return [];
}

const cases = Object.entries(probes).flatMap(([name, calls]) =>
  calls.map((call, i) => ({ name: `${name} #${i}`, call })),
);

describe("sprig strings — no function emits a lone surrogate", () => {
  it("covers every function the registry exposes", () => {
    expect(Object.keys(probes).sort()).toEqual(Object.keys(sprigStrings()).sort());
  });

  it.each(cases)("$name", ({ call }) => {
    // Collected rather than asserted one at a time: a failure prints
    // the offending string instead of "expected false to be true".
    const malformed = reachableStrings(call()).filter((s) => !s.isWellFormed());
    expect(malformed).toEqual([]);
  });
});
