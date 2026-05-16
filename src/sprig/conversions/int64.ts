import { parseBase0 } from "./parseBase0.js";

/**
 * `int64 v` — coerce to a 64-bit integer. Returns `bigint` so the
 * full Go-`int64` precision survives the round-trip (a JS `number`
 * loses precision past 2^53).
 *
 * Shares `parseBase0`'s base-detect + sign rules with `int`, so the
 * input shape (what string forms are recognized) is the same. The
 * **carrier** differs — `int` returns a JS `number` and applies a
 * `Number.isSafeInteger` clamp on output so the returned value
 * round-trips without precision loss; `int64`'s `bigint` carrier
 * holds the full int64 range, so no clamp is needed and string
 * forms like `"9007199254740993"` (past 2^53) survive unchanged.
 * The divergence is intentional: the carrier *forces* the precision
 * policy at this boundary, not the other way around.
 */

// [LAW:types-are-the-program] Carrier choice (number vs bigint)
// drives the policy split. Input parsing is shared (`parseBase0`) so
// the string-form contract cannot drift; output handling diverges
// only at the precision boundary the carrier itself defines.
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
