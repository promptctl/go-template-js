import { describe, expect, it } from "vitest";
import { float64 } from "./float64.js";

describe("sprig.float64", () => {
  it("passes through numbers", () => {
    expect(float64(3.14)).toBe(3.14);
    expect(float64(-7)).toBe(-7);
  });

  it("parses float strings", () => {
    expect(float64("3.14")).toBe(3.14);
    expect(float64("-2.5e3")).toBe(-2500);
  });

  it("returns 0 for unparseable strings", () => {
    expect(float64("abc")).toBe(0);
    expect(float64("")).toBe(0);
  });

  it("handles bigints, booleans, and unsupported kinds", () => {
    expect(float64(42n)).toBe(42);
    expect(float64(true)).toBe(1);
    expect(float64(false)).toBe(0);
    expect(float64(null)).toBe(0);
    expect(float64({})).toBe(0);
  });
});
