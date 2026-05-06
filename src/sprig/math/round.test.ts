import { describe, expect, it } from "vitest";
import { round } from "./round.js";

describe("sprig.round", () => {
  it("rounds to nearest integer by default", () => {
    expect(round(1.4)).toBe(1);
    expect(round(1.5)).toBe(2);
  });
  it("rounds half-away-from-zero for negative numbers", () => {
    expect(round(-1.5)).toBe(-2);
  });
  it("respects optional precision", () => {
    expect(round(1.2345, 2)).toBeCloseTo(1.23);
  });
});
