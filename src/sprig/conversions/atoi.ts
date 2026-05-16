/**
 * `atoi s` — parse a base-10 integer string. Returns 0 for any
 * non-parseable input, matching Go sprig (`strconv.Atoi(s)` with the
 * error discarded). Hex/octal prefixes are *not* accepted — that's
 * what `toDecimal` is for.
 */

// [LAW:single-enforcer] The `"string"` gate validates the kind once;
// the body trusts it. Parse failure → 0 (Go-parity: `strconv.Atoi`
// errors, sprig discards).
//
// The `Number.isSafeInteger` guard is this converter's own
// *output-precision policy*, not a mirror of Go's int64 boundary or
// the gate's matcher predicate:
//   - Go's `strconv.Atoi` admits decimals up to int64 max
//     (9223372036854775807). JS doubles lose integer precision past
//     `Number.MAX_SAFE_INTEGER` (2^53 - 1), so values in
//     [MAX_SAFE_INTEGER+1, int64-max] are *valid in Go* but would
//     round on the way through JS — returning them would silently
//     hand the caller a different integer than the string named.
//     Collapsing the whole range to 0 is the precision-safe choice.
//   - The "int" ArgType matcher is looser than this guard for
//     `number`-discriminant inputs (accepts any finite number, even
//     unsafe ones — callers passing a number are trusted to mean it).
//     This guard is stricter because atoi's input is a string, not a
//     trusted JS number, so the strictness applies at the parse step.
// Runaway-to-Infinity collapse falls out of the same predicate as a
// free side effect.
export function atoi(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isSafeInteger(n) ? n : 0;
}
