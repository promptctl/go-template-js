import { describe, expect, it } from "vitest";
import { slice } from "./slice.js";

describe("sprig.slice", () => {
  it("slices with i, j", () => {
    expect(slice([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
  });
  it("treats missing j as end", () => {
    expect(slice([1, 2, 3], 1)).toEqual([2, 3]);
  });
});
