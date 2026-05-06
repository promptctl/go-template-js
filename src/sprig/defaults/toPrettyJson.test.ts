import { describe, expect, it } from "vitest";
import { toPrettyJson } from "./toPrettyJson.js";

describe("sprig.toPrettyJson", () => {
  it("indents with 2 spaces", () => {
    expect(toPrettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(toPrettyJson([1, 2])).toBe("[\n  1,\n  2\n]");
  });

  it("returns 'null' for undefined input", () => {
    expect(toPrettyJson(undefined)).toBe("null");
  });
});
