import { describe, expect, it } from "vitest";
import { randAscii } from "./randAscii.js";

// Printable ASCII: 0x20 (space) through 0x7E (~) inclusive.
const ASCII_RE = /^[\x20-\x7E]*$/;

describe("sprig.randAscii", () => {
  it("output length matches n", () => {
    expect(randAscii(12, Math.random)).toHaveLength(12);
    expect(randAscii(0, Math.random)).toHaveLength(0);
  });

  it("all characters are printable ASCII (0x20–0x7E)", () => {
    for (let trial = 0; trial < 50; trial++) {
      expect(randAscii(20, Math.random)).toMatch(ASCII_RE);
    }
  });

  it("deterministic: PRNG=0 yields space (0x20)", () => {
    expect(randAscii(4, () => 0)).toBe("    ");
  });

  it("deterministic: PRNG≈1 yields tilde (0x7E)", () => {
    // floor(0.9999 * 95) = 94 → ASCII[94] = '~' (0x7E)
    expect(randAscii(2, () => 0.9999)).toBe("~~");
  });

  it("accepts bigint n", () => {
    expect(randAscii(3n, () => 0)).toBe("   ");
  });
});
