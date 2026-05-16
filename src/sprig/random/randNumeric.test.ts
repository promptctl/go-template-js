import { describe, expect, it } from "vitest";
import { randNumeric } from "./randNumeric.js";

const NUMERIC_RE = /^[0-9]*$/;

describe("sprig.randNumeric", () => {
  it("output length matches n", () => {
    expect(randNumeric(6, Math.random)).toHaveLength(6);
    expect(randNumeric(0, Math.random)).toHaveLength(0);
  });

  it("all characters are [0-9]", () => {
    for (let trial = 0; trial < 50; trial++) {
      expect(randNumeric(10, Math.random)).toMatch(NUMERIC_RE);
    }
  });

  it("deterministic with seeded PRNG", () => {
    // PRNG 0 → charset[0] = '0'
    expect(randNumeric(5, () => 0)).toBe("00000");
    // PRNG 0.9 → floor(0.9*10) = 9 → '9'
    expect(randNumeric(3, () => 0.9)).toBe("999");
  });
});
