import { describe, expect, it } from "vitest";
import { sortAlpha } from "./sortAlpha.js";

describe("sprig.sortAlpha", () => {
  it("sorts strings lexicographically", () => {
    expect(sortAlpha(["banana", "apple", "cherry"])).toEqual(["apple", "banana", "cherry"]);
  });
  it("stringifies non-string elements before sorting", () => {
    expect(sortAlpha([3, 1, 2])).toEqual(["1", "2", "3"]);
    expect(sortAlpha([true, false, true])).toEqual(["false", "true", "true"]);
  });
  it("mixed types use lexicographic ordering of stringified values", () => {
    // Stringified: ["1", "a", "true"] → ASCII order "1" < "a" < "true".
    expect(sortAlpha([1, "a", true])).toEqual(["1", "a", "true"]);
  });
  it("empty list returns empty list", () => {
    expect(sortAlpha([])).toEqual([]);
  });
  it("filters null/undefined entries before sorting", () => {
    expect(sortAlpha(["b", null, "a", undefined, "c"])).toEqual(["a", "b", "c"]);
  });
});
