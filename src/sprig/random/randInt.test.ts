import { describe, expect, it } from "vitest";
import { randInt } from "./randInt.js";

// Deterministic PRNG: returns 0.0, 0.25, 0.5, 0.75 cyclically.
const cyclic = (() => {
  const seq = [0.0, 0.25, 0.5, 0.75] as const;
  let i = 0;
  return (): number => seq[i++ % seq.length] as number;
})();

describe("sprig.randInt", () => {
  it("returns value within [min, max)", () => {
    for (let trial = 0; trial < 200; trial++) {
      const v = randInt(5, 20, Math.random);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(20);
    }
  });

  it("exact output for cyclic PRNG (proves injection)", () => {
    // cyclic gives 0.0 → floor(0.0*(20-5))+5 = 5
    expect(randInt(5, 20, cyclic)).toBe(5);
    // 0.25 → floor(0.25*15)+5 = floor(3.75)+5 = 3+5 = 8
    expect(randInt(5, 20, cyclic)).toBe(8);
    // 0.5 → floor(0.5*15)+5 = 7+5 = 12
    expect(randInt(5, 20, cyclic)).toBe(12);
  });

  it("accepts bigint arguments", () => {
    const v = randInt(0n, 10n, () => 0.9);
    expect(v).toBe(9);
  });

  it("returns min when PRNG is 0", () => {
    expect(randInt(3, 10, () => 0)).toBe(3);
  });
});
