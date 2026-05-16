import { describe, expect, it } from "vitest";
import { atoi } from "./atoi.js";

describe("sprig.atoi", () => {
  it("parses base-10 integers", () => {
    expect(atoi("42")).toBe(42);
    expect(atoi("-7")).toBe(-7);
    expect(atoi("+7")).toBe(7);
    expect(atoi("0")).toBe(0);
  });

  it("returns 0 for non-parseable input (Go discards err)", () => {
    expect(atoi("abc")).toBe(0);
    expect(atoi("")).toBe(0);
    expect(atoi("3.14")).toBe(0);
    expect(atoi("12x")).toBe(0);
  });

  it("does not accept hex/octal prefixes (use toDecimal for that)", () => {
    expect(atoi("0xff")).toBe(0);
    expect(atoi("0755")).toBe(755);
  });

  // [LAW:types-are-the-program] Pins atoi's *output-precision policy*:
  // returned numbers must be safe-integer-representable so they
  // round-trip without precision loss. The policy is stricter than
  // Go-sprig (Go's `strconv.Atoi` admits up to int64-max) and stricter
  // than the gate's "int" matcher (which accepts any finite number for
  // number-discriminant inputs). It applies here because atoi's input
  // is a string, not a trusted JS number — the strictness lives at the
  // parse step, not the gate.
  it("collapses values above MAX_SAFE_INTEGER (within int64) to 0 — output-precision policy", () => {
    // 2^53 = 9007199254740992. Valid in Go (well under int64 max),
    // *exactly* representable as a JS double (it's a power of 2), but
    // one greater than MAX_SAFE_INTEGER (2^53 - 1). Pinning this
    // boundary prevents a future relaxation back to an int64-only
    // overflow check, which would let precision-losing values through.
    expect(atoi("9007199254740992")).toBe(0);
    expect(atoi("-9007199254740992")).toBe(0);
    // Just past int64 max — finite but precision-losing under JS.
    expect(atoi("9223372036854775808")).toBe(0);
    expect(atoi("-9223372036854775809")).toBe(0);
    // Boundary the other way: MAX_SAFE_INTEGER itself survives.
    expect(atoi(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(atoi(String(Number.MIN_SAFE_INTEGER))).toBe(Number.MIN_SAFE_INTEGER);
  });

  it("collapses runaway-to-Infinity inputs to 0", () => {
    // Long-enough digit strings overflow `Number.parseInt` to JS
    // Infinity; Go would also reject these. Falls out of the same
    // safe-integer predicate as the precision-losing case above.
    expect(atoi("9".repeat(400))).toBe(0);
    expect(atoi("-" + "9".repeat(400))).toBe(0);
  });
});
