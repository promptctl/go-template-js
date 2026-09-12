import { describe, expect, it } from "vitest";
import { subf } from "./subf.js";

describe("sprig.subf", () => {
  it("float subtraction", () => {
    expect(subf(1.5, 0.5)).toBe(1);
  });

  it("folds left over every trailing argument, as Go's variadic subf does", () => {
    expect(subf(10, 3, 2)).toBe(5);
  });

  it("returns the first argument alone, Go's variadic minimum", () => {
    expect(subf(10)).toBe(10);
  });
});
