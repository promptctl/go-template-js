import { describe, expect, it } from "vitest";
import { divf } from "./divf.js";

describe("sprig.divf", () => {
  it("float division preserves the remainder", () => {
    expect(divf(10, 3)).toBeCloseTo(3.333333);
  });
});
