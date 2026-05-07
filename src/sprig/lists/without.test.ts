import { describe, expect, it } from "vitest";
import { without } from "./without.js";

describe("sprig.without", () => {
  it("filters out the listed values", () => {
    expect(without([1, 2, 3, 4], 2, 4)).toEqual([1, 3]);
  });

  // Closes audit G4: structurally-equal object should be excluded, matching
  // Go's reflect.DeepEqual semantics.
  it("excludes structurally-equal objects (deep equality, not reference)", () => {
    expect(without([{ k: 1 }, { k: 2 }], { k: 1 })).toEqual([{ k: 2 }]);
  });
});
