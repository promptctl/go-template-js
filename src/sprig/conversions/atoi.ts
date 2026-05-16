/**
 * `atoi s` — parse a base-10 integer string. Returns 0 for any
 * non-parseable input, matching Go sprig (`strconv.Atoi(s)` with the
 * error discarded). Hex/octal prefixes are *not* accepted — that's
 * what `toDecimal` is for.
 */

// [LAW:single-enforcer] The `"string"` gate validates the kind once;
// the body trusts it. Parse failure → 0 (Go-parity). Magnitude
// overflow → 0 as well: Go's `strconv.Atoi` errors on overflow and
// sprig discards the error, so a huge digit string like "9".repeat(400)
// must collapse to 0 — *not* JS's Infinity. This also keeps the
// registration's `returnType: "int"` theorem honest: the "int" carrier
// rejects non-finite numbers, so the body must never emit them.
export function atoi(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
