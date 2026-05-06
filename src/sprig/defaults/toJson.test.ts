import { describe, expect, it } from "vitest";
import { toJson } from "./toJson.js";

describe("sprig.toJson", () => {
  it("serializes scalars", () => {
    expect(toJson(42)).toBe("42");
    expect(toJson("hi")).toBe('"hi"');
    expect(toJson(true)).toBe("true");
    expect(toJson(null)).toBe("null");
    expect(toJson(undefined)).toBe("null");
  });

  it("serializes arrays and objects compactly", () => {
    expect(toJson([1, 2, 3])).toBe("[1,2,3]");
    expect(toJson({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });
});
