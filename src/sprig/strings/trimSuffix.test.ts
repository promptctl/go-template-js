import { describe, expect, it } from "vitest";
import { trimSuffix } from "./trimSuffix.js";

describe("sprig.trimSuffix", () => {
  it("strips matching suffix only when present", () => {
    expect(trimSuffix("-bar", "foo-bar")).toBe("foo");
    expect(trimSuffix("-bar", "qux")).toBe("qux");
  });
});
