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
// [LAW:types-are-the-program] Every return path collapses anything
// outside JS's safe-integer range (NaN, ±Infinity, *and* finite-but-
// precision-losing values like 2^60 or `Number(2n**1024n)`) to 0 so
// the registration's `returnType: "int"` is a true theorem at every
// return site. The predicate is `Number.isSafeInteger`, which is the
// same one the "int" ArgType matcher uses for bigint inputs at the
// gate — one definition of "int" shared between input and output,
// not two. Aligns with Go-sprig's overflow-becomes-zero behavior
// (`strconv.ParseInt(..., 0, 64)` errors on overflow; sprig discards).
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
