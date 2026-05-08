/**
 * `swapcase s` — flip case per code point. Mirrors Go sprig's
 * `goutils.SwapCase` for ASCII and Latin-1 inputs.
 *
 * Go's `goutils.SwapCase` carries a "preceded by whitespace" flag and
 * uses `unicode.ToTitle` instead of `ToUpper` for the first lowercase
 * letter of each word. For ASCII letters Title and Upper coincide, so
 * the flag has no observable effect on output and is omitted here —
 * keeping it would be load-bearing complexity that the type system
 * cannot constrain. Non-ASCII ligatures (e.g. German `ß` whose JS
 * `toUpperCase` returns `SS` while Go's `ToTitle` returns `ẞ`) diverge,
 * matching the README's existing Go/Unicode divergence statements.
 */

// [LAW:single-enforcer] The "string" gate validates the kind once at
// dispatch; the body trusts it.
//
// [LAW:dataflow-not-control-flow] Each iteration unconditionally
// emits one transformed code point. The category check selects the
// transformation; it never gates whether the emit happens.
export function swapcase(s: string): string {
  let out = "";
  for (const ch of s) {
    if (isUpper(ch)) {
      out += ch.toLowerCase();
    } else if (isLower(ch)) {
      out += ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

function isLower(ch: string): boolean {
  return ch !== ch.toUpperCase() && ch === ch.toLowerCase();
}
