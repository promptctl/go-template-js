import { describe, expect, it } from "vitest";
import { regexMatch } from "./regexMatch.js";

describe("sprig.regexMatch", () => {
  it("returns true on match", () => {
    expect(regexMatch("\\d+", "abc123")).toBe(true);
    expect(regexMatch("\\d+", "abc")).toBe(false);
  });
});
