import { describe, expect, it } from "vitest";
import { divf } from "./divf.js";

describe("sprig.divf", () => {
  it("float division preserves the remainder", () => {
    expect(divf(10, 3)).toBeCloseTo(3.333333);
  });

  it("folds left over every trailing argument, as Go's variadic divf does", () => {
    expect(divf(30, 3, 2)).toBe(5);
  });

  it("returns the first argument alone, Go's variadic minimum", () => {
    expect(divf(10)).toBe(10);
  });
});
