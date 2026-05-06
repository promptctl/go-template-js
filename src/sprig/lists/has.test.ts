import { describe, expect, it } from "vitest";
import { has } from "./has.js";

describe("sprig.has", () => {
  it("checks membership", () => {
    expect(has(2, [1, 2, 3])).toBe(true);
    expect(has(9, [1, 2, 3])).toBe(false);
  });
});
