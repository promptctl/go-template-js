import { describe, expect, it } from "vitest";
import { add1f } from "./add1f.js";

describe("sprig.add1f", () => {
  it("float increment", () => {
    expect(add1f(0)).toBe(1);
    expect(add1f(2.5)).toBe(3.5);
    expect(add1f(-0.5)).toBe(0.5);
  });
  it("does not truncate fractional input", () => {
    expect(add1f(1.9)).toBeCloseTo(2.9);
  });
});
