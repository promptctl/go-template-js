import { describe, expect, it } from "vitest";
import { randAlpha } from "./randAlpha.js";

const ALPHA_RE = /^[A-Za-z]*$/;
const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("sprig.randAlpha", () => {
  it("output length matches n", () => {
    expect(randAlpha(10, Math.random)).toHaveLength(10);
    expect(randAlpha(0, Math.random)).toHaveLength(0);
  });

  it("all characters are [A-Za-z]", () => {
    for (let trial = 0; trial < 50; trial++) {
      expect(randAlpha(20, Math.random)).toMatch(ALPHA_RE);
    }
  });

  it("deterministic with seeded PRNG", () => {
    // PRNG always returns 0 → always picks charset[0] = 'a'
    expect(randAlpha(5, () => 0)).toBe("aaaaa");
    // PRNG always returns 0.9999... → picks last char 'Z'
    expect(randAlpha(3, () => 0.9999)).toBe(
      (ALPHA[Math.floor(0.9999 * ALPHA.length)] as string).repeat(3),
    );
  });

  it("accepts bigint n", () => {
    expect(randAlpha(4n, () => 0)).toBe("aaaa");
  });
});
