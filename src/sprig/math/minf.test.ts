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
  it("propagates NaN to match Go math.Min behavior", () => {
    expect(minf(1, NaN, 3)).toBeNaN();
    expect(minf(NaN)).toBeNaN();
  });
});
