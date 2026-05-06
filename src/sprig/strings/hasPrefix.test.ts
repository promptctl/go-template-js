import { describe, expect, it } from "vitest";
import { hasPrefix } from "./hasPrefix.js";

describe("sprig.hasPrefix", () => {
  it("true on match", () => {
    expect(hasPrefix("foo", "foobar")).toBe(true);
    expect(hasPrefix("bar", "foobar")).toBe(false);
  });
});
