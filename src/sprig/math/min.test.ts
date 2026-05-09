import { describe, expect, it } from "vitest";
import { min } from "./min.js";

describe("sprig.min", () => {
  it("variadic minimum", () => {
    expect(min(3, 1, 2)).toBe(1);
  });
  it("truncates fractional args to int64 like Go sprig", () => {
    expect(min(1.5, 2.5, 3.5)).toBe(1);
    expect(min(1.9, 2.9)).toBe(1);
  });
});
