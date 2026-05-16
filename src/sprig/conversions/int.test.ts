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

  // [LAW:types-are-the-program] Pins int's *output-precision policy*
  // at every entry path: returned numbers are safe-integer-
  // representable so they round-trip without loss. The policy is
  // stricter than Go-sprig's int64 boundary and stricter than the
  // gate's "int" matcher for number-discriminant inputs (the matcher
  // trusts callers passing a number; this converter trusts no input
  // shape, so it owns precision at the output edge). Three blocks —
  // one per discriminant — so a future relaxation on any branch (e.g.
  // back to `Number.isFinite`, or to an int64-only overflow check)
  // fails loudly.
  it("collapses unsafe values to 0 (number path)", () => {
    expect(int(2 ** 60)).toBe(0); // finite but above MAX_SAFE_INTEGER
    expect(int(-(2 ** 60))).toBe(0);
    expect(int(Number.POSITIVE_INFINITY)).toBe(0);
    expect(int(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(int(Number.NaN)).toBe(0);
    // Boundary: MAX_SAFE_INTEGER itself is still a valid int.
    expect(int(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("collapses unsafe values to 0 (bigint path)", () => {
    expect(int(2n ** 1024n)).toBe(0); // overflows Number() to Infinity
    expect(int(2n ** 60n)).toBe(0); // finite-but-unsafe under Number()
    expect(int(-(2n ** 60n))).toBe(0);
    // Boundary: MAX_SAFE_INTEGER as a bigint survives.
    expect(int(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("collapses unsafe values to 0 (string path)", () => {
    // Pin the JS safe-integer boundary, distinct from Go int64:
    // "9007199254740992" (= 2^53) is well within int64 but just past
    // MAX_SAFE_INTEGER. A future relaxation to an int64-only overflow
    // check would let this through and silently round downstream
    // arithmetic.
    expect(int("9007199254740992")).toBe(0);
    expect(int("-9007199254740992")).toBe(0);
    expect(int("9223372036854775808")).toBe(0); // > int64 max
    expect(int("-9223372036854775809")).toBe(0); // < int64 min
    expect(int("9".repeat(400))).toBe(0); // runaway → Infinity
    expect(int("0x" + "f".repeat(20))).toBe(0); // hex overflow
    // Boundary: string form of MAX_SAFE_INTEGER survives.
    expect(int(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});
