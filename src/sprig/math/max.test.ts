import { describe, expect, it } from "vitest";
import { max } from "./max.js";

describe("sprig.max", () => {
  it("variadic maximum", () => {
    expect(max(3, 1, 2)).toBe(3);
  });
});
