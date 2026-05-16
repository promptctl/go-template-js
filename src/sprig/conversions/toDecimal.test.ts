import { describe, expect, it } from "vitest";
import { toDecimal } from "./toDecimal.js";

describe("sprig.toDecimal", () => {
  it("parses base-8 (octal) strings — that's the whole job", () => {
    expect(toDecimal("0755")).toBe(493);
    expect(toDecimal("755")).toBe(493);
    expect(toDecimal("0")).toBe(0);
    expect(toDecimal("-0777")).toBe(-511);
    expect(toDecimal("+10")).toBe(8);
  });

  it("does NOT detect 0x/0b/0o prefixes (Go hard-codes base 8)", () => {
    expect(toDecimal("0xff")).toBe(0);
    expect(toDecimal("0o755")).toBe(0);
    expect(toDecimal("0b1010")).toBe(0);
  });

  it("rejects non-octal digits", () => {
    expect(toDecimal("08")).toBe(0);
    expect(toDecimal("9")).toBe(0);
    expect(toDecimal("abc")).toBe(0);
    expect(toDecimal("")).toBe(0);
    expect(toDecimal("3.14")).toBe(0);
  });

  // [LAW:types-are-the-program] Pins toDecimal's *output-precision
  // policy* — same shape as atoi's. The boundary is JS safe-integer,
  // stricter than Go's int64 (octals decoding into the
  // [MAX_SAFE_INTEGER+1, int64-max] band are valid in Go but lose
  // precision under JS doubles) and stricter than the gate's "int"
  // matcher (looser for number-discriminant inputs). Applies here
  // because the input is a string, not a trusted JS number.
  it("collapses octals above MAX_SAFE_INTEGER (within int64) to 0 — output-precision policy", () => {
    // 2^54 in octal = "1000000000000000000". Well under int64 max,
    // exactly representable as a JS double, but one bit too wide for
    // safe-integer range. Pinning this boundary prevents a future
    // relaxation to an int64-only overflow check.
    expect(toDecimal("1000000000000000000")).toBe(0);
    expect(toDecimal("-1000000000000000000")).toBe(0);
    // Boundary the other way: 2^53 - 1 = MAX_SAFE_INTEGER, octal
    // "377777777777777777", survives.
    expect(toDecimal("377777777777777777")).toBe(Number.MAX_SAFE_INTEGER);
    expect(toDecimal("-377777777777777777")).toBe(Number.MIN_SAFE_INTEGER);
  });

  it("collapses runaway-to-Infinity octal inputs to 0", () => {
    // Long-enough octal overflows parseInt to Infinity (Go rejects
    // too); falls out of the same safe-integer predicate.
    expect(toDecimal("7".repeat(400))).toBe(0);
    expect(toDecimal("-" + "7".repeat(400))).toBe(0);
  });
});
