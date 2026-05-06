import { describe, expect, it } from "vitest";
import { wrap } from "./wrap.js";

describe("sprig.wrap", () => {
  it("wraps at word boundaries", () => {
    expect(wrap(5, "the quick brown fox")).toBe("the\nquick\nbrown\nfox");
  });
  it("preserves words longer than the width", () => {
    expect(wrap(3, "longword")).toBe("longword");
  });
});
