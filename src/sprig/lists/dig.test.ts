import { describe, expect, it } from "vitest";
import { TypeMismatchError } from "../../errors.js";
import { dig } from "./dig.js";

describe("sprig.dig", () => {
  const data = { a: { b: { c: 42 } }, top: "value" };

  it("returns the deepest value when all keys present", () => {
    expect(dig("a", "b", "c", "miss", data)).toBe(42);
  });
  it("returns the default when a key is missing", () => {
    expect(dig("a", "x", "c", "miss", data)).toBe("miss");
    expect(dig("nope", "miss", data)).toBe("miss");
  });
  it("returns the default at the deepest level when leaf key is missing", () => {
    expect(dig("a", "b", "z", "miss", data)).toBe("miss");
  });
  it("returns top-level value with a single key", () => {
    expect(dig("top", "miss", data)).toBe("value");
  });
  it("rejects fewer than 3 arguments", () => {
    expect(() => dig("a", data)).toThrow(TypeMismatchError);
    expect(() => dig(data)).toThrow(TypeMismatchError);
    expect(() => dig()).toThrow(TypeMismatchError);
  });
  it("rejects non-dict last arg", () => {
    expect(() => dig("k", "miss", [1, 2, 3])).toThrow(TypeMismatchError);
    expect(() => dig("k", "miss", "string")).toThrow(TypeMismatchError);
    expect(() => dig("k", "miss", null)).toThrow(TypeMismatchError);
  });
  it("rejects non-string keys", () => {
    expect(() => dig(1 as unknown as string, "miss", data)).toThrow(TypeMismatchError);
  });
  it("rejects non-dict intermediate when more keys remain", () => {
    // top is a string, so digging "top.x" with two keys hits a non-dict mid-walk.
    expect(() => dig("top", "x", "miss", data)).toThrow(TypeMismatchError);
  });
  it("returns falsy values verbatim when present (not the default)", () => {
    const d = { x: { y: 0 }, n: { o: null }, e: { f: "" } };
    expect(dig("x", "y", "miss", d)).toBe(0);
    expect(dig("n", "o", "miss", d)).toBe(null);
    expect(dig("e", "f", "miss", d)).toBe("");
  });
});
