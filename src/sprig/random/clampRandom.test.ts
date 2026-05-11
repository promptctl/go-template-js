import { describe, expect, it } from "vitest";
import { clampRandom, randIntFromRange, randString } from "./_prng.js";
import { shuffle } from "./shuffle.js";

describe("clampRandom", () => {
  it("clamps NaN to 0", () => {
    expect(clampRandom(NaN)).toBe(0);
  });

  it("clamps Infinity to 0", () => {
    expect(clampRandom(Infinity)).toBe(0);
  });

  it("clamps -Infinity to 0", () => {
    expect(clampRandom(-Infinity)).toBe(0);
  });

  it("clamps 1 to upper bound", () => {
    expect(clampRandom(1)).toBe(0.9999999999999999);
  });

  it("clamps negative values to 0", () => {
    expect(clampRandom(-0.5)).toBe(0);
  });

  it("passes values already in [0, 1) through", () => {
    expect(clampRandom(0)).toBe(0);
    expect(clampRandom(0.5)).toBe(0.5);
    expect(clampRandom(0.9999999999999999)).toBe(0.9999999999999999);
  });
});

describe("clampRandom integration — randIntFromRange", () => {
  it("NaN PRNG produces valid index (min)", () => {
    expect(randIntFromRange(0, 10, () => NaN)).toBe(0);
  });

  it("Infinity PRNG produces valid index (min)", () => {
    expect(randIntFromRange(0, 10, () => Infinity)).toBe(0);
  });

  it("negative PRNG produces valid index (min)", () => {
    expect(randIntFromRange(5, 15, () => -42)).toBe(5);
  });

  it("1.0 PRNG produces valid index (max - 1)", () => {
    expect(randIntFromRange(0, 10, () => 1.0)).toBe(9);
  });
});

describe("clampRandom integration — shuffle", () => {
  it("NaN PRNG does not corrupt shuffle output", () => {
    const input = "abcdef";
    const result = shuffle(input, () => NaN);
    expect(result).toHaveLength(input.length);
    expect([...result].sort().join("")).toBe([...input].sort().join(""));
  });

  it("Infinity PRNG does not corrupt shuffle output", () => {
    const input = "abcdef";
    const result = shuffle(input, () => Infinity);
    expect(result).toHaveLength(input.length);
    expect([...result].sort().join("")).toBe([...input].sort().join(""));
  });
});

describe("clampRandom integration — randString", () => {
  it("NaN PRNG produces valid characters", () => {
    const result = randString(10, "abc", () => NaN);
    expect(result).toHaveLength(10);
    expect(result).toBe("aaaaaaaaaa");
  });

  it("Infinity PRNG produces valid characters", () => {
    const result = randString(10, "abc", () => Infinity);
    expect(result).toHaveLength(10);
    for (const ch of result) {
      expect("abc").toContain(ch);
    }
  });
});
