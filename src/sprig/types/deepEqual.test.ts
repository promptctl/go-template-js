import { describe, expect, it } from "vitest";
import { deepEqual } from "./deepEqual.js";

describe("sprig.deepEqual", () => {
  it("primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(1, "1")).toBe(false);
  });
  it("arrays", () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
  it("plain objects", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it("Maps", () => {
    expect(deepEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true);
  });
});
