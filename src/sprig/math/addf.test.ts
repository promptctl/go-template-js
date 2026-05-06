import { describe, expect, it } from "vitest";
import { addf } from "./addf.js";

describe("sprig.addf", () => {
  it("preserves fractional precision", () => {
    expect(addf(0.1, 0.2)).toBeCloseTo(0.3);
  });
});
