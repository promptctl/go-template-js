import { describe, expect, it } from "vitest";
import { toRawJson } from "./toRawJson.js";

describe("sprig.toRawJson", () => {
  it("encodes primitives", () => {
    expect(toRawJson(42)).toBe("42");
    expect(toRawJson("hi")).toBe('"hi"');
    expect(toRawJson(true)).toBe("true");
    expect(toRawJson(null)).toBe("null");
    expect(toRawJson(undefined)).toBe("null");
  });

  it("does not HTML-escape <, >, & (Go: SetEscapeHTML(false))", () => {
    expect(toRawJson("<a>")).toBe('"<a>"');
    expect(toRawJson("a&b")).toBe('"a&b"');
  });

  it("encodes arrays and objects", () => {
    expect(toRawJson([1, 2, 3])).toBe("[1,2,3]");
    expect(toRawJson({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });
});
