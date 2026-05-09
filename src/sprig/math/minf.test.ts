import { describe, expect, it } from "vitest";
import { minf } from "./minf.js";

describe("sprig.minf", () => {
  it("variadic float minimum", () => {
    expect(minf(1.5, 2.5, 3.5)).toBe(1.5);
    expect(minf(7.7)).toBe(7.7);
  });
  it("preserves fractional precision (unlike `min`)", () => {
    expect(minf(1.6, 2.5)).toBe(1.6);
  });
  it("handles negatives", () => {
    expect(minf(-3, -1, -2)).toBe(-3);
  });
  it("accepts bigint via the number slot", () => {
    expect(minf(3, 2n, 1)).toBe(1);
  });
});
