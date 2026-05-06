import { describe, expect, it } from "vitest";
import { coalesce } from "./coalesce.js";

describe("sprig.coalesce", () => {
  it("returns the first non-empty value", () => {
    expect(coalesce(null, "", 0, "yes", "later")).toBe("yes");
  });

  it("returns undefined when all values are empty", () => {
    expect(coalesce(null, undefined, "", 0, [], {})).toBeUndefined();
  });

  it("treats 0 as empty (sprig gotcha)", () => {
    expect(coalesce(0, 1)).toBe(1);
  });
});
