import { describe, expect, it } from "vitest";
import { len } from "./len.js";

describe("sprig.len", () => {
  it("length of arrays/strings/maps/objects", () => {
    expect(len([1, 2])).toBe(2);
    expect(len("ab")).toBe(2);
    expect(len(new Map([["a", 1]]))).toBe(1);
    expect(len({ a: 1, b: 2 })).toBe(2);
  });
});
