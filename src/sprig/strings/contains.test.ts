import { describe, expect, it } from "vitest";
import { contains } from "./contains.js";

describe("sprig.contains", () => {
  it("substring presence", () => {
    expect(contains("foo", "foobar")).toBe(true);
    expect(contains("baz", "foobar")).toBe(false);
  });
});
