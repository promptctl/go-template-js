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
export function int(v: unknown): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const parsed = parseBase0(v);
    if (parsed === null) return 0;
    const n = Number.parseInt(parsed.digits, parsed.base);
    return Number.isNaN(n) ? 0 : parsed.sign * n;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}
