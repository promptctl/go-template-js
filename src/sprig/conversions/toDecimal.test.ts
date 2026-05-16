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

  // [LAW:types-are-the-program] Pins the registration's
  // `returnType: "int"` theorem against octal overflow. Go's
  // `strconv.ParseInt(..., 8, 64)` errors on overflow and sprig
  // discards → 0; both the finite-but-precision-losing case and the
  // runaway-to-Infinity case must collapse to 0 here for the "int"
  // contract to hold.
  it("collapses values outside JS safe-integer range to 0 (Go-parity overflow)", () => {
    // Octal 0o1000000000000000000 = 2^54, beyond MAX_SAFE_INTEGER but
    // still finite as a double.
    expect(toDecimal("1000000000000000000")).toBe(0);
    expect(toDecimal("-1000000000000000000")).toBe(0);
    // Runaway: parseInt overflows to Infinity for a long-enough octal.
    expect(toDecimal("7".repeat(400))).toBe(0);
    // Boundary: an octal whose decimal value is MAX_SAFE_INTEGER is
    // still valid. 2^53 - 1 in octal is "377777777777777777".
    expect(toDecimal("377777777777777777")).toBe(Number.MAX_SAFE_INTEGER);
  });
});
