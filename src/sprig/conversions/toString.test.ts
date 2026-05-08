import { describe, expect, it } from "vitest";
import { toString } from "./toString.js";

describe("sprig.toString", () => {
  it("passes strings through", () => {
    expect(toString("hello")).toBe("hello");
    expect(toString("")).toBe("");
  });

  it("formats primitives via Go-%v", () => {
    expect(toString(42)).toBe("42");
    expect(toString(3.14)).toBe("3.14");
    expect(toString(true)).toBe("true");
    expect(toString(false)).toBe("false");
    expect(toString(42n)).toBe("42");
  });

  it("renders nil as <nil>", () => {
    expect(toString(null)).toBe("<nil>");
    expect(toString(undefined)).toBe("<nil>");
  });

  it("formats arrays with Go bracket-space syntax", () => {
    expect(toString([1, 2, 3])).toBe("[1 2 3]");
    expect(toString(["a", "b"])).toBe("[a b]");
  });
});
