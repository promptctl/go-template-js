/**
 * `atoi s` — parse a base-10 integer string. Returns 0 for any
 * non-parseable input, matching Go sprig (`strconv.Atoi(s)` with the
 * error discarded). Hex/octal prefixes are *not* accepted — that's
 * what `toDecimal` is for.
 */

// [LAW:single-enforcer] The `"string"` gate validates the kind once;
// the body trusts it. Parse failure → 0 (Go-parity).
export function atoi(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}
