import { describe, expect, it } from "vitest";
import { maxf } from "./maxf.js";

describe("sprig.maxf", () => {
  it("variadic float maximum", () => {
    expect(maxf(1.5, 2.5, 3.5)).toBe(3.5);
    expect(maxf(0.1)).toBe(0.1);
  });
  it("preserves fractional precision (unlike `max`)", () => {
    expect(maxf(1.5, 2.4)).toBe(2.4);
  });
  it("handles negatives", () => {
    expect(maxf(-3, -1, -2)).toBe(-1);
  });
  it("accepts bigint via the number slot", () => {
    expect(maxf(1, 2n, 3)).toBe(3);
  });
<<<<<<< HEAD
=======
  it("propagates NaN to match Go math.Max behavior", () => {
    expect(maxf(1, NaN, 3)).toBeNaN();
    expect(maxf(NaN)).toBeNaN();
  });
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
});
