import { describe, expect, it } from "vitest";
import { int64 } from "./int64.js";

describe("sprig.int64", () => {
  it("returns bigint for full int64 precision", () => {
    expect(int64(42)).toBe(42n);
    expect(int64(42n)).toBe(42n);
  });

  it("preserves precision past 2^53 from string input", () => {
    expect(int64("9007199254740993")).toBe(9007199254740993n);
  });

  it("truncates floats toward zero", () => {
    expect(int64(3.7)).toBe(3n);
    expect(int64(-3.7)).toBe(-3n);
  });

  it("parses base-detect strings (matches int)", () => {
    expect(int64("42")).toBe(42n);
    expect(int64("-7")).toBe(-7n);
    expect(int64("0xff")).toBe(255n);
    expect(int64("0755")).toBe(493n);
    expect(int64("0b1010")).toBe(10n);
  });

  it("returns 0n for non-parseable strings", () => {
    expect(int64("abc")).toBe(0n);
    expect(int64("08")).toBe(0n);
  });

  it("handles booleans and unsupported kinds", () => {
    expect(int64(true)).toBe(1n);
    expect(int64(false)).toBe(0n);
    expect(int64(null)).toBe(0n);
    expect(int64({})).toBe(0n);
  });
});
