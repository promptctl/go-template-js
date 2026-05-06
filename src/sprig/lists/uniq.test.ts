import { describe, expect, it } from "vitest";
import { uniq } from "./uniq.js";

describe("sprig.uniq", () => {
  it("dedupes preserving first-occurrence order", () => {
    expect(uniq([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });
});
