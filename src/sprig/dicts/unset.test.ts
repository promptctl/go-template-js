import { describe, expect, it } from "vitest";
import { unset } from "./unset.js";

describe("sprig.unset", () => {
  it("mutates the receiver to drop the key and returns it (Go sprig parity)", () => {
    const original = { a: 1, b: 2 } as Record<string, unknown>;
    const next = unset(original, "a");
    expect(next).toBe(original);
    expect(original).toEqual({ b: 2 });
  });

  it("removing a missing key leaves the dict untouched", () => {
    const d = { a: 1 } as Record<string, unknown>;
    unset(d, "missing");
    expect(d).toEqual({ a: 1 });
  });

  it("non-dict receivers pass through untouched", () => {
    expect(unset(null, "k")).toBeNull();
  });
});
