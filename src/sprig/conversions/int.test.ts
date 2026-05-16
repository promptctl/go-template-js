import { describe, expect, it } from "vitest";
import { int } from "./int.js";

describe("sprig.int", () => {
  it("passes through integers", () => {
    expect(int(42)).toBe(42);
    expect(int(-7)).toBe(-7);
  });

  it("truncates floats toward zero", () => {
    expect(int(3.7)).toBe(3);
    expect(int(-3.7)).toBe(-3);
    expect(int(0.5)).toBe(0);
  });

  it("converts bigints to number", () => {
    expect(int(42n)).toBe(42);
  });

  it("parses base-detect strings (Go: ParseInt(s, 0, 64))", () => {
    expect(int("42")).toBe(42);
    expect(int("-7")).toBe(-7);
    expect(int("0xff")).toBe(255);
    expect(int("0X10")).toBe(16);
    expect(int("0755")).toBe(493);
    expect(int("0b1010")).toBe(10);
  });

  it("returns 0 for non-parseable strings", () => {
    expect(int("abc")).toBe(0);
    expect(int("3.14")).toBe(0);
    expect(int("08")).toBe(0); // 8 not octal
    expect(int("")).toBe(0);
  });

  it("converts booleans to 0/1", () => {
    expect(int(true)).toBe(1);
    expect(int(false)).toBe(0);
  });

  it("returns 0 for unparseable / unsupported", () => {
    expect(int(null)).toBe(0);
    expect(int(undefined)).toBe(0);
    expect(int({})).toBe(0);
    expect(int([])).toBe(0);
  });

  // [LAW:types-are-the-program] Pins the registration's
  // `returnType: "int"` theorem at every entry path. The body's
  // overflow predicate is `Number.isSafeInteger`, matching the "int"
  // ArgType matcher's bigint-input check at the gate (evaluator.ts);
  // these regressions cover all three discriminants (number, bigint,
  // string) so a future relaxation back to `Number.isFinite` — which
  // would let precision-losing values through — fails loudly.
  it("collapses values outside JS safe-integer range to 0 (number path)", () => {
    expect(int(2 ** 60)).toBe(0); // finite but unsafe
    expect(int(-(2 ** 60))).toBe(0);
    expect(int(Number.POSITIVE_INFINITY)).toBe(0);
    expect(int(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(int(Number.NaN)).toBe(0);
    // Boundary: MAX_SAFE_INTEGER itself is still a valid int.
    expect(int(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("collapses values outside JS safe-integer range to 0 (bigint path)", () => {
    expect(int(2n ** 1024n)).toBe(0); // overflows Number() to Infinity
    expect(int(2n ** 60n)).toBe(0); // finite-but-unsafe under Number()
    expect(int(-(2n ** 60n))).toBe(0);
    // Boundary: MAX_SAFE_INTEGER as a bigint survives.
    expect(int(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("collapses values outside JS safe-integer range to 0 (string path)", () => {
    expect(int("9223372036854775808")).toBe(0); // > int64 max
    expect(int("-9223372036854775809")).toBe(0); // < int64 min
    expect(int("9".repeat(400))).toBe(0); // runaway → Infinity
    expect(int("0x" + "f".repeat(20))).toBe(0); // hex overflow
    // Boundary: string form of MAX_SAFE_INTEGER survives.
    expect(int(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});
