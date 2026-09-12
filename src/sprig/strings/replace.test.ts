import { describe, expect, it } from "vitest";
import { replace } from "./replace.js";

describe("sprig.replace", () => {
  it("replaces all occurrences", () => {
    expect(replace("a", "X", "abcabc")).toBe("XbcXbc");
  });
  it("returns input unchanged when old is not found", () => {
    expect(replace("z", "X", "abc")).toBe("abc");
  });
  it("empty old splits between runes, never inside one", () => {
    // Go additionally inserts at both ends ("-\u{10348}-x-"); that edge
    // difference is a separate, non-Unicode divergence.
    expect(replace("", "-", "\u{10348}x")).toBe("\u{10348}-x");
  });
});
