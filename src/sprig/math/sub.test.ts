import { describe, expect, it } from "vitest";
import { sub } from "./sub.js";

describe("sprig.sub", () => {
  it("integer subtraction", () => {
    expect(sub(10, 3)).toBe(7);
    expect(sub(0, 5)).toBe(-5);
  });
});
