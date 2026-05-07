import { describe, expect, it } from "vitest";
import { uniq } from "./uniq.js";

describe("sprig.uniq", () => {
  it("dedupes preserving first-occurrence order", () => {
    expect(uniq([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  // Closes audit G4: structurally-equal objects must dedup, matching Go's
  // reflect.DeepEqual semantics. Reference equality (Set) would keep both.
  it("dedupes structurally-equal objects (deep equality, not reference)", () => {
    expect(uniq([{ k: 1 }, { k: 1 }, { k: 2 }])).toEqual([{ k: 1 }, { k: 2 }]);
  });

  it("dedupes structurally-equal arrays", () => {
    expect(uniq([[1, 2], [1, 2], [3]])).toEqual([[1, 2], [3]]);
  });
});
