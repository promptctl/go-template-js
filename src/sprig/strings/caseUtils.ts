/**
 * Word-classifying state machine ported from huandu/xstrings v1.3.3
 * (https://github.com/huandu/xstrings/blob/v1.3.3/convert.go), which
 * Go sprig delegates to for `snakecase`, `camelcase`, and `kebabcase`.
 *
 * [LAW:one-source-of-truth] Three sprig funcs target the same
 * algorithm with two different connector chars (`_`, `-`) plus a
 * separate camel walk. The state machine lives once in this module;
 * the per-func files are thin specializations.
 *
 * ## Port notes
 *
 * Go iterates UTF-8 bytes via `utf8.DecodeRuneInString`. JS strings
 * are UTF-16; iterating with `for…of` (or `Array.from(s)`) yields
 * code points the same way Go yields runes, so the rune-level logic
 * carries over. We intentionally do NOT attempt to mirror xstrings'
 * `isAlphabet` CJK-exclusion table — for ASCII/Latin templates, which
 * are what real users feed sprig, the simpler `isLetter` test
 * matches Go's output. The fixture suite pins the cases consumers
 * actually exercise.
 *
 * `unicode.ToTitle` from Go has no JS equivalent for ASCII letters
 * (Title and Upper coincide for code points without a separate Title
 * mapping), so we use `String.toUpperCase()` everywhere xstrings would
 * have used either.
 */

// [LAW:types-are-the-program] WordType is the discriminator the
// state machine routes on. Object-frozen literal keeps the same
// runtime shape as a const enum without the bundler/isolatedModules
// pitfalls biome flags.
const WordType = {
  Invalid: 0,
  Number: 1,
  UpperCase: 2,
  Alphabet: 3,
  Connector: 4,
  Punct: 5,
  Other: 6,
} as const;
type WordType = (typeof WordType)[keyof typeof WordType];

interface Word {
  readonly wt: WordType;
  readonly text: string;
}

const isConnectorRe = /^[-_\s]$/;
const isPunctRe = /^\p{P}$/u;
const isLetterRe = /^\p{L}$/u;
const isUpperRe = /^\p{Lu}$/u;
const isNumberRe = /^\p{N}$/u;

// All classifiers accept `undefined` as a no-op false. The caller
// shape is "is the next code point in class X" — out-of-bounds is
// trivially "no", which keeps the loop conditions readable without
// duplicating an `i < cps.length` guard at every call site.
function isConnector(ch: string | undefined): boolean {
  return ch !== undefined && isConnectorRe.test(ch);
}

function isAlphabet(ch: string | undefined): boolean {
  return ch !== undefined && isLetterRe.test(ch);
}

function isUpper(ch: string | undefined): boolean {
  return ch !== undefined && isUpperRe.test(ch);
}

function isNumber(ch: string | undefined): boolean {
  return ch !== undefined && isNumberRe.test(ch);
}

function isPunct(ch: string | undefined): boolean {
  return ch !== undefined && isPunctRe.test(ch);
}

/**
 * Pull the next word off `cps` starting at `i`. Returns the word's
 * type + text and the index of the first code point after the word.
 *
 * Mirrors xstrings.nextWord: classifies the first rune, then extends
 * the word as long as the next rune fits the same class — with a
 * special "HTTPStatus" carve-out where an upper-run followed by a
 * lower letter releases the last upper into the next word.
 */
function nextWord(cps: readonly string[], start: number): { word: Word; next: number } {
  if (start >= cps.length) {
    return { word: { wt: WordType.Invalid, text: "" }, next: start };
  }
  // Bounds checked above; the cast trades a redundant runtime check
  // for the same nullability shape used elsewhere in this module
  // (e.g. `split.ts` has `parts[i] as string`).
  const r = cps[start] as string;
  let i = start + 1;

  if (isConnector(r)) {
    while (i < cps.length && isConnector(cps[i])) i++;
    return { word: { wt: WordType.Connector, text: cps.slice(start, i).join("") }, next: i };
  }
  if (isPunct(r)) {
    while (i < cps.length && isPunct(cps[i])) i++;
    return { word: { wt: WordType.Punct, text: cps.slice(start, i).join("") }, next: i };
  }
  if (isUpper(r)) {
    if (i >= cps.length) {
      return { word: { wt: WordType.UpperCase, text: r }, next: i };
    }
    if (isUpper(cps[i])) {
      // Run of uppers. Walk until non-upper.
      let endOfRun = i;
      while (endOfRun < cps.length && isUpper(cps[endOfRun])) endOfRun++;
      // "HTTPStatus" carve-out: when the run is followed by a letter
      // (which must be lower since the run already ended), the LAST
      // upper of the run is released into the next word so it can
      // become "HTTP" + "Status" rather than "HTTPS" + "tatus".
      if (endOfRun < cps.length && isAlphabet(cps[endOfRun])) {
        return {
          word: { wt: WordType.UpperCase, text: cps.slice(start, endOfRun - 1).join("") },
          next: endOfRun - 1,
        };
      }
      return {
        word: { wt: WordType.UpperCase, text: cps.slice(start, endOfRun).join("") },
        next: endOfRun,
      };
    }
    if (isAlphabet(cps[i])) {
      // Single upper followed by lower-run: e.g. "FirstName" -> "First".
      let end = i + 1;
      while (end < cps.length && isAlphabet(cps[end]) && !isUpper(cps[end])) end++;
      return {
        word: { wt: WordType.UpperCase, text: cps.slice(start, end).join("") },
        next: end,
      };
    }
    // Single upper followed by non-letter (digit, connector, etc.).
    return { word: { wt: WordType.UpperCase, text: r }, next: i };
  }
  if (isAlphabet(r)) {
    while (i < cps.length && isAlphabet(cps[i]) && !isUpper(cps[i])) i++;
    return { word: { wt: WordType.Alphabet, text: cps.slice(start, i).join("") }, next: i };
  }
  if (isNumber(r)) {
    while (i < cps.length && isNumber(cps[i])) i++;
    return { word: { wt: WordType.Number, text: cps.slice(start, i).join("") }, next: i };
  }
  while (
    i < cps.length &&
    !isConnector(cps[i]) &&
    !isAlphabet(cps[i]) &&
    !isNumber(cps[i]) &&
    !isPunct(cps[i])
  ) {
    i++;
  }
  return { word: { wt: WordType.Other, text: cps.slice(start, i).join("") }, next: i };
}

/**
 * Lowercase a word's text into the output buffer. Connector words
 * have their internal connector chars rewritten to the target
 * connector; all other words are lowered character-by-character.
 */
function pushLowered(buf: string[], word: Word, connector: string): void {
  if (word.wt !== WordType.UpperCase && word.wt !== WordType.Connector) {
    buf.push(word.text);
    return;
  }
  for (const ch of word.text) {
    if (isConnector(ch)) {
      buf.push(connector);
    } else if (isUpper(ch)) {
      buf.push(ch.toLowerCase());
    } else {
      buf.push(ch);
    }
  }
}

/**
 * Port of xstrings.camelCaseToLowerCase. Walks word-by-word and
 * inserts `connector` at the right transitions to produce snake/kebab
 * output.
 */
export function camelCaseToLowerCase(s: string, connector: string): string {
  if (s.length === 0) return "";
  const cps = Array.from(s);
  const buf: string[] = [];

  let { word, next: i } = nextWord(cps, 0);

  while (i < cps.length) {
    if (word.wt !== WordType.Connector) {
      pushLowered(buf, word, connector);
    }
    const prev = word;
    const last = word;
    ({ word, next: i } = nextWord(cps, i));

    if (prev.wt === WordType.Number) {
      while (word.wt === WordType.Alphabet || word.wt === WordType.Number) {
        pushLowered(buf, word, connector);
        ({ word, next: i } = nextWord(cps, i));
      }
      if (
        word.wt !== WordType.Invalid &&
        word.wt !== WordType.Punct &&
        word.wt !== WordType.Connector
      ) {
        buf.push(connector);
      }
      continue;
    }
    if (prev.wt === WordType.Connector) {
      pushLowered(buf, last, connector);
      continue;
    }
    if (prev.wt === WordType.Punct) {
      // nothing
      continue;
    }
    // default: prev is alphabet/upper/other
    if (word.wt !== WordType.Number) {
      if (word.wt !== WordType.Connector && word.wt !== WordType.Punct) {
        buf.push(connector);
      }
      continue;
    }
    // word is a Number — special handling per xstrings.
    if (i >= cps.length) {
      // No following word; let the loop tail emit `word`.
      continue;
    }
    const numberWord = word;
    ({ word, next: i } = nextWord(cps, i));
    // If after the number isn't an alphabet, treat the number as its
    // own word (e.g. "Duration2m3s" → "duration_2m3s").
    if (word.wt !== WordType.Alphabet) {
      pushLowered(buf, numberWord, connector);
      if (word.wt !== WordType.Connector && word.wt !== WordType.Punct) {
        buf.push(connector);
      }
      continue;
    }
    // Lowercase letters follow the number, so the number is its own
    // word with a leading connector: e.g. "HTTP2xx" → "http_2xx".
    buf.push(connector);
    pushLowered(buf, numberWord, connector);
    while (word.wt === WordType.Alphabet || word.wt === WordType.Number) {
      pushLowered(buf, word, connector);
      ({ word, next: i } = nextWord(cps, i));
    }
    if (
      word.wt !== WordType.Invalid &&
      word.wt !== WordType.Connector &&
      word.wt !== WordType.Punct
    ) {
      buf.push(connector);
    }
  }
  pushLowered(buf, word, connector);
  return buf.join("").toLowerCase();
}

/**
 * Port of xstrings.ToCamelCase. Two-phase walk:
 * - Phase 1 preserves leading connectors verbatim, capitalizes the
 *   first non-connector rune.
 * - Phase 2 walks `(prev, curr)` rune pairs, collapsing connector→
 *   non-connector to a single uppered rune, preserving runs of
 *   adjacent connectors, and lowercasing other runes.
 */
export function camelCase(s: string): string {
  if (s.length === 0) return "";
  const cps = Array.from(s);
  const buf: string[] = [];

  let i = 0;
  let r0 = "";

  while (i < cps.length) {
    r0 = cps[i] as string;
    i++;
    if (!isConnector(r0)) {
      r0 = r0.toUpperCase();
      break;
    }
    buf.push(r0);
  }

  if (i >= cps.length) {
    if (cps.length > 0) buf.push(r0);
    return buf.join("");
  }

  while (i < cps.length) {
    const r1 = r0;
    r0 = cps[i] as string;
    i++;

    if (isConnector(r0) && isConnector(r1)) {
      buf.push(r1);
      continue;
    }
    if (isConnector(r1)) {
      r0 = r0.toUpperCase();
    } else {
      r0 = r0.toLowerCase();
      buf.push(r1);
    }
  }
  buf.push(r0);
  return buf.join("");
}
