import { describe, expect, it } from "vitest";
import { defaultFn } from "./default.js";

describe("sprig.default", () => {
  it("returns the second value when it is non-empty", () => {
    expect(defaultFn("fallback", "real")).toBe("real");
    expect(defaultFn(0, 1)).toBe(1);
  });

  it("returns the default when the value is empty", () => {
    expect(defaultFn("fallback", "")).toBe("fallback");
    expect(defaultFn("fallback", null)).toBe("fallback");
    expect(defaultFn("fallback", undefined)).toBe("fallback");
    expect(defaultFn("fallback", 0)).toBe("fallback"); // sprig gotcha
    expect(defaultFn("fallback", [])).toBe("fallback");
  });
});
