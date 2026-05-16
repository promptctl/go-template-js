import { describe, expect, it } from "vitest";
import { randAlphaNum } from "./randAlphaNum.js";

const ALPHANUM_RE = /^[A-Za-z0-9]*$/;

describe("sprig.randAlphaNum", () => {
  it("output length matches n", () => {
    expect(randAlphaNum(8, Math.random)).toHaveLength(8);
    expect(randAlphaNum(0, Math.random)).toHaveLength(0);
  });

  it("all characters are [A-Za-z0-9]", () => {
    for (let trial = 0; trial < 50; trial++) {
      expect(randAlphaNum(20, Math.random)).toMatch(ALPHANUM_RE);
    }
  });

  it("deterministic with seeded PRNG", () => {
    expect(randAlphaNum(4, () => 0)).toBe("aaaa");
  });
});
