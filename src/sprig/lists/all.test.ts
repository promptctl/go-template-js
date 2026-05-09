import { describe, expect, it } from "vitest";
import { all } from "./all.js";

describe("sprig.all", () => {
  it("returns true when every value is non-empty", () => {
    expect(all(1, "a", true, [1])).toBe(true);
  });
  it("returns false on the first empty value", () => {
    expect(all(1, "", true)).toBe(false);
    expect(all(1, 0, true)).toBe(false);
    expect(all(1, null, true)).toBe(false);
    expect(all(1, [], true)).toBe(false);
    expect(all(1, false, true)).toBe(false);
  });
  it("empty argument list is vacuously true", () => {
    expect(all()).toBe(true);
  });
});
