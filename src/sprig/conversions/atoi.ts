/**
 * `atoi s` — parse a base-10 integer string. Returns 0 for any
 * non-parseable input, matching Go sprig (`strconv.Atoi(s)` with the
 * error discarded). Hex/octal prefixes are *not* accepted — that's
 * what `toDecimal` is for.
 */

// [LAW:single-enforcer] The `"string"` gate validates the kind once;
// the body trusts it. Parse failure → 0 (Go-parity). Magnitude
// overflow → 0 as well: Go's `strconv.Atoi` errors on overflow and
// sprig discards the error, so digit strings beyond JS's safe-integer
// range — finite-but-precision-losing (e.g. `"9223372036854775808"`,
// which `Number.parseInt` rounds to a finite double) *and* fully
// runaway (e.g. `"9".repeat(400)` → JS Infinity) — both collapse to 0.
// The matching predicate is the same one the "int" ArgType matcher
// uses for bigint inputs at the gate: `Number.isSafeInteger`. Using it
// here keeps `returnType: "int"` a true theorem at every return site —
// the gate's input predicate and this body's output predicate are one
// definition of "int", not two.
export function atoi(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isSafeInteger(n) ? n : 0;
}
