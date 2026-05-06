import { describe, expect, it } from "vitest";
import { subf } from "./subf.js";

describe("sprig.subf", () => {
  it("float subtraction", () => {
    expect(subf(1.5, 0.5)).toBe(1);
  });
});
