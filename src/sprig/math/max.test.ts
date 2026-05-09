import { describe, expect, it } from "vitest";
import { max } from "./max.js";

describe("sprig.max", () => {
  it("variadic maximum", () => {
    expect(max(3, 1, 2)).toBe(3);
  });
  it("truncates fractional args to int64 like Go sprig", () => {
    expect(max(1.5, 2.5, 3.5)).toBe(3);
    expect(max(1.9, 2.9)).toBe(2);
  });
});
