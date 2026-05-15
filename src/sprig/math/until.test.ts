import { describe, expect, it } from "vitest";
import { until } from "./until.js";

describe("sprig.until", () => {
  it("positive count counts up from zero", () => {
    expect(until(5)).toEqual([0, 1, 2, 3, 4]);
    expect(until(1)).toEqual([0]);
  });
  it("zero count is empty", () => {
    expect(until(0)).toEqual([]);
  });
  it("negative count counts down from zero", () => {
    expect(until(-3)).toEqual([0, -1, -2]);
  });
});
