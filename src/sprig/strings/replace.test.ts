import { describe, expect, it } from "vitest";
import { replace } from "./replace.js";

describe("sprig.replace", () => {
  it("replaces all occurrences", () => {
    expect(replace("a", "X", "abcabc")).toBe("XbcXbc");
  });
  it("returns input unchanged when old is not found", () => {
    expect(replace("z", "X", "abc")).toBe("abc");
  });
});
