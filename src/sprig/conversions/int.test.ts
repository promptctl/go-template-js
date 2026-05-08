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
});
