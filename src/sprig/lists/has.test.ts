import { describe, expect, it } from "vitest";
import { has } from "./has.js";

describe("sprig.has", () => {
  it("checks membership", () => {
    expect(has(2, [1, 2, 3])).toBe(true);
    expect(has(9, [1, 2, 3])).toBe(false);
  });

  // Closes audit G4: structurally-equal object should be found, matching Go's
  // reflect.DeepEqual semantics.
  it("matches structurally-equal objects (deep equality, not reference)", () => {
    expect(has({ k: 1 }, [{ k: 1 }, { k: 2 }])).toBe(true);
    expect(has({ k: 9 }, [{ k: 1 }, { k: 2 }])).toBe(false);
  });
});
