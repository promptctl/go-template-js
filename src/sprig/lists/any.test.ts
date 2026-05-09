import { describe, expect, it } from "vitest";
import { any } from "./any.js";

describe("sprig.any", () => {
  it("returns true when at least one value is non-empty", () => {
    expect(any(0, "", null, "found")).toBe(true);
    expect(any(false, true)).toBe(true);
  });
  it("returns false when every value is empty", () => {
    expect(any(0, "", null, false, [])).toBe(false);
  });
  it("empty argument list is false", () => {
    expect(any()).toBe(false);
  });
});
