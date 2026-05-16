/**
 * `toDecimal s` — parse `s` as base-8 (octal) and return the decimal
 * value. Despite the name, sprig hard-codes base 8 — see Masterminds
 * `toDecimal`: `strconv.ParseInt(fmt.Sprintf("%v", v), 8, 64)`.
 *
 * Prefixes are *not* accepted (only base-8 explicit means no `0o`/`0x`
 * detection). Non-octal digits or non-string-parseable input → 0.
 *
 * Examples:
 *   toDecimal "0755" → 493   (the "convert octal-string to decimal" use case)
 *   toDecimal "08"   → 0     (8 is not an octal digit; Go errors)
 *   toDecimal "0xff" → 0     (no prefix detection at base 8)
 */
// [LAW:one-source-of-truth] Behavior is "parse base-8" full stop.
// Anyone who wants base-detect uses `int` instead; that's where the
// auto-detect rule lives (`parseBase0`).
// Magnitude overflow → 0 (Go's `strconv.ParseInt(..., 8, 64)` errors on
// overflow; sprig discards the error). Required for the registration's
// `returnType: "int"` theorem: "int" rejects non-finite numbers, so a
// long-enough octal string must collapse to 0, not Infinity.
export function toDecimal(s: string): number {
  if (!/^[+-]?[0-7]+$/.test(s)) return 0;
  const sign = s[0] === "-" ? -1 : 1;
  const body = s[0] === "+" || s[0] === "-" ? s.slice(1) : s;
  const n = Number.parseInt(body, 8);
  return Number.isFinite(n) ? sign * n : 0;
}
