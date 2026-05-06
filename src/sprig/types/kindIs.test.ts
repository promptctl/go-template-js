import { describe, expect, it } from "vitest";
import { kindIs } from "./kindIs.js";

describe("sprig.kindIs", () => {
  it("compares kind name", () => {
    expect(kindIs("string", "x")).toBe(true);
    expect(kindIs("array", [1])).toBe(true);
    expect(kindIs("map", new Map())).toBe(true);
    expect(kindIs("string", 42)).toBe(false);
  });
});
