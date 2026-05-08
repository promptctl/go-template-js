/**
 * `nospace s` — strip whitespace from `s`. Mirrors Go sprig's
 * `goutils.DeleteWhiteSpace`, which iterates bytes and drops anything
 * `unicode.IsSpace` returns true for. ECMAScript `\s` covers the same
 * ASCII whitespace set (space, tab, CR, LF, VT, FF) — the goutils
 * implementation is byte-indexed so multi-byte Unicode whitespace
 * already escapes its filter, leaving ASCII as the de-facto contract.
 */

// [LAW:single-enforcer] The `"string"` gate validates the kind once
// at dispatch; the body trusts it.
export function nospace(s: string): string {
  return s.replace(/\s+/g, "");
}
