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

  // [LAW:types-are-the-program] Pins the registration's
  // `returnType: "int"` theorem. Go's `strconv.Atoi` errors on
  // overflow and sprig discards the error → 0; this test fixes that
  // contract for both classes of overflow the gate's "int" matcher
  // would reject: finite-but-precision-losing values and runaway
  // values that parse to JS Infinity.
  it("collapses values outside JS safe-integer range to 0 (Go-parity overflow)", () => {
    // Just past int64 max — parses to a finite but precision-losing
    // double (9223372036854776000); rejected by "int" matcher.
    expect(atoi("9223372036854775808")).toBe(0);
    expect(atoi("-9223372036854775809")).toBe(0);
    // Runaway: parseInt overflows to Infinity.
    expect(atoi("9".repeat(400))).toBe(0);
    expect(atoi("-" + "9".repeat(400))).toBe(0);
    // Boundary: MAX_SAFE_INTEGER itself is still a valid int.
    expect(atoi(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});
