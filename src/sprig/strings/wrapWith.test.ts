import { describe, expect, it } from "vitest";
import { wrapWith } from "./wrapWith.js";

describe("sprig.wrapWith", () => {
  it("wraps using a custom separator", () => {
    expect(wrapWith(5, "|", "the quick brown fox")).toBe("the|quick|brown|fox");
  });
});
