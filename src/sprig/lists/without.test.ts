import { describe, expect, it } from "vitest";
import { without } from "./without.js";

describe("sprig.without", () => {
  it("filters out the listed values", () => {
    expect(without([1, 2, 3, 4], 2, 4)).toEqual([1, 3]);
  });
});
