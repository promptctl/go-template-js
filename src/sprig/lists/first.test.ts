import { describe, expect, it } from "vitest";
import { first } from "./first.js";

describe("sprig.first", () => {
  it("first element of array", () => {
    expect(first([1, 2, 3])).toBe(1);
  });
  it("undefined for empty", () => {
    expect(first([])).toBeUndefined();
  });
});
