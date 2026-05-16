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
//
// The `Number.isSafeInteger` guard is this converter's
// *output-precision policy* (same shape as `atoi.ts` — see that file
// for the full rationale). Two distinct boundaries collapse into
// one predicate:
//   - Octal strings whose decimal value lands in
//     [MAX_SAFE_INTEGER+1, int64-max] are valid under Go's
//     `strconv.ParseInt(..., 8, 64)` but round under JS doubles.
//     Returning them silently would hand the caller a different
//     integer than the string named — collapsed to 0 instead.
//   - Octal strings long enough to overflow `Number.parseInt` to JS
//     Infinity (which Go *would* also reject) fall out of the same
//     predicate as a free side effect.
export function toDecimal(s: string): number {
  if (!/^[+-]?[0-7]+$/.test(s)) return 0;
  const sign = s[0] === "-" ? -1 : 1;
  const body = s[0] === "+" || s[0] === "-" ? s.slice(1) : s;
  const n = sign * Number.parseInt(body, 8);
  return Number.isSafeInteger(n) ? n : 0;
}
