/**
 * `initials s` — port of `goutils.Initials` (what Go sprig's `initials`
 * delegates to): the first character of each whitespace-separated word,
 * case preserved — `"Ada Lovelace"` -> `"AL"`, `"foo bar baz"` -> `"fbb"`.
 *
 * Byte-faithful: goutils indexes the word's first BYTE, so a multi-byte
 * leading character yields that byte as a code point — `"Ölga"` -> `"Ã"`,
 * `"𐍈foo"` -> `"ð"` (both verified against the Go conformance generator),
 * never the full glyph.
 */
export function initials(s: string): string {
  const enc = new TextEncoder();
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    // [LAW:dataflow-not-control-flow] spread of the 1-byte slice: an (impossible)
    // empty word contributes "" naturally instead of a guarded fallback value.
    .map((w) => String.fromCharCode(...enc.encode(w).slice(0, 1)))
    .join("");
}
