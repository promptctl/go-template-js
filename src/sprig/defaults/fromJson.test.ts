import { describe, expect, it } from "vitest";
import { fromJson } from "./fromJson.js";

describe("sprig.fromJson", () => {
  it("parses scalars", () => {
    expect(fromJson("42")).toBe(42);
    expect(fromJson('"hi"')).toBe("hi");
    expect(fromJson("true")).toBe(true);
    expect(fromJson("null")).toBeNull();
  });

  it("parses arrays and objects", () => {
    expect(fromJson("[1,2,3]")).toEqual([1, 2, 3]);
    expect(fromJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => fromJson("not-json")).toThrow();
  });
});
