import { describe, expect, it } from "vitest";
import { hasSuffix } from "./hasSuffix.js";

describe("sprig.hasSuffix", () => {
  it("true on match", () => {
    expect(hasSuffix("bar", "foobar")).toBe(true);
    expect(hasSuffix("foo", "foobar")).toBe(false);
  });
});
