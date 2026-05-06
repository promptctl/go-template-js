import { describe, expect, it } from "vitest";
import { trimPrefix } from "./trimPrefix.js";

describe("sprig.trimPrefix", () => {
  it("strips matching prefix only when present", () => {
    expect(trimPrefix("foo-", "foo-bar")).toBe("bar");
    expect(trimPrefix("foo-", "qux")).toBe("qux");
  });
});
