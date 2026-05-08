import { parseBase0 } from "./parseBase0.js";

/**
 * `int64 v` — coerce to a 64-bit integer. Returns `bigint` so the
 * full Go-`int64` precision survives the round-trip (a JS `number`
 * loses precision past 2^53).
 *
 * Same coercion rules as `int`; differs only in the carrier type.
 */

// [LAW:one-type-per-behavior] `int` and `int64` differ only in
// representation precision, not in coercion semantics. They share
// `parseBase0` so the string-parse behavior cannot drift.
export function int64(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const parsed = parseBase0(v);
    if (parsed === null) return 0n;
    // BigInt accepts "0x"/"0b"/"0o" literal forms directly; rebuild
    // a literal we can hand to BigInt() to avoid re-implementing
    // arbitrary-precision parsing per base.
    const prefix =
      parsed.base === 16 ? "0x" : parsed.base === 2 ? "0b" : parsed.base === 8 ? "0o" : "";
    const n = BigInt(prefix + parsed.digits);
    return parsed.sign === -1 ? -n : n;
  }
  if (typeof v === "boolean") return v ? 1n : 0n;
  return 0n;
}
