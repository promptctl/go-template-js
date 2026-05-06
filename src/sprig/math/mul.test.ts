import { describe, expect, it } from "vitest";
import { mul } from "./mul.js";

describe("sprig.mul", () => {
  it("variadic integer product", () => {
    expect(mul(2, 3, 4)).toBe(24);
    expect(mul()).toBe(1);
  });
});
