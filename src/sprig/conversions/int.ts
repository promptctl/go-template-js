import { parseBase0 } from "./parseBase0.js";

/**
 * `int v` — coerce to integer, truncating toward zero. Strings parse
 * with Go's `strconv.ParseInt(s, 0, 64)` rule (base auto-detect: hex
 * `0x`, octal `0`/`0o`, binary `0b`, decimal default). Anything not
 * parseable → 0.
 */

// [LAW:dataflow-not-control-flow] Variability lives in *values*; the
// shape of the dispatch (one branch per JS kind) mirrors the JS type
// system's discriminator, not an external mode flag.
//
// `Number.isSafeInteger` is this converter's *output-precision
// policy*, not the gate's input predicate. The `"int"` ArgType
// matcher is looser for `number`-discriminant inputs at the gate —
// it accepts any finite number, including unsafe ones like 2^60,
// because callers passing a number are trusted to mean it. This
// converter accepts heterogeneous input (`"value"` slot — number,
// bigint, string, boolean, anything) and produces a number, so it
// owns precision at the output edge: a returned value is guaranteed
// to round-trip without loss. Sources of unsafe results — finite
// `Math.trunc(2**60)`, `Number(2n**1024n)` → Infinity,
// `Number.parseInt` of a long-enough digit string — all collapse to
// 0 under one predicate. Stricter than Go-sprig's int64 boundary,
// stricter than the gate's number-branch predicate, but stricter
// in the precision-safe direction.
export function int(v: unknown): number {
  if (typeof v === "number") {
    const n = Math.trunc(v);
    return Number.isSafeInteger(n) ? n : 0;
  }
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : 0;
  }
  if (typeof v === "string") {
    const parsed = parseBase0(v);
    if (parsed === null) return 0;
    const n = parsed.sign * Number.parseInt(parsed.digits, parsed.base);
    return Number.isSafeInteger(n) ? n : 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}
