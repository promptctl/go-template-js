import { describe, expect, it } from "vitest";
import { join } from "./join.js";

describe("sprig.join", () => {
  it("joins a list with separator", () => {
    expect(join("-", ["a", "b", "c"])).toBe("a-b-c");
  });
  it("returns empty string for empty list", () => {
    expect(join("-", [])).toBe("");
  });
});
