import { describe, expect, it } from "vitest";
import { untilStep } from "./untilStep.js";

describe("sprig.untilStep", () => {
  it("ascending range, exclusive of stop", () => {
    expect(untilStep(0, 5, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(untilStep(2, 10, 2)).toEqual([2, 4, 6, 8]);
  });

  it("descending range with negative step", () => {
    expect(untilStep(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
    expect(untilStep(10, 0, -3)).toEqual([10, 7, 4, 1]);
  });

  it("returns empty when step direction disagrees with stop direction", () => {
    expect(untilStep(0, 5, -1)).toEqual([]);
    expect(untilStep(5, 0, 1)).toEqual([]);
  });

  it("returns empty for zero step", () => {
    expect(untilStep(0, 5, 0)).toEqual([]);
    expect(untilStep(5, 0, 0)).toEqual([]);
  });

  it("returns empty when start equals stop", () => {
    expect(untilStep(3, 3, 1)).toEqual([]);
  });
});
