import { describe, expect, it } from "vitest";
import { deepCopy } from "./deepCopy.js";

describe("sprig.deepCopy", () => {
  it("returns an independent copy of nested structures", () => {
    const original = { a: 1, b: [{ c: 2 }] };
    const copy = deepCopy(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.b).not.toBe(original.b);
    expect(copy.b[0]).not.toBe(original.b[0]);
  });
});
