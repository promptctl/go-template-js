/**
 * The rune-level string seam: the operations Go gets for free on its
 * strings and JS does not.
 *
 * [LAW:parse-dont-validate] Go walks a string as runes; JS strings are
 * UTF-16, so a character-position operation done on the raw string
 * (`s.slice(0, 1)`, `s[i]`, `s.length`, `s.split("")`) splits an astral
 * character in half and yields a lone surrogate — `trunc 1 "𐍈x"`
 * returned "\ud800", for which `isWellFormed()` is false. Decoding once,
 * up front, is the checkpoint: every element of the returned array is a
 * whole character, so an index into the middle of one is unrepresentable
 * and no slice of it can produce a lone surrogate. Callers re-encode
 * with `.join("")`.
 *
 * Code points deliberately — not UTF-16 units, and not grapheme
 * clusters. Grapheme clustering would hold `"é"` together, a third
 * behaviour matching neither Go nor this engine.
 *
 * For splitting this buys exact Go parity. For slicing it buys
 * well-formedness instead: Go slices `trunc`/`substr`/`abbrev` by BYTE,
 * so `trunc 1 "𐍈x"` is the single invalid byte `\xf0` there and the
 * whole `𐍈` here. That residual divergence is intended and tracked
 * separately; a rune is the closest well-formed unit to Go's byte.
 */

/**
 * Decode `s` to its code points. The array is freshly built per call,
 * so callers may permute it in place (`shuffle` does).
 */
export function runes(s: string): string[] {
  return Array.from(s);
}

/**
 * `strings.Split(s, sep)` — an empty separator splits between runes,
 * where JS's `s.split("")` splits between UTF-16 units and shears
 * astral characters into lone surrogates.
 *
 * [LAW:single-enforcer] `split`, `splitList`, `splitn`, and `replace`
 * all reach for Go's split; the empty-separator rule lives here so the
 * four cannot drift on it.
 */
export function goSplit(sep: string, s: string): string[] {
  return sep === "" ? runes(s) : s.split(sep);
}
