import { describe, expect, it } from "vitest";
import { min } from "./min.js";

describe("sprig.min", () => {
  it("variadic minimum", () => {
    expect(min(3, 1, 2)).toBe(1);
  });
});
