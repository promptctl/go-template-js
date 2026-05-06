import { describe, expect, it } from "vitest";
import { dict } from "./dict.js";

describe("sprig.dict", () => {
  it("builds from alternating key/value pairs", () => {
    expect(dict("a", 1, "b", 2)).toEqual({ a: 1, b: 2 });
  });
  it("empty returns {}", () => {
    expect(dict()).toEqual({});
  });
});
