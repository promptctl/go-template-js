import { describe, expect, it } from "vitest";
import { regexFind } from "./regexFind.js";

describe("sprig.regexFind", () => {
  it("first match or empty string", () => {
    expect(regexFind("\\d+", "abc123def456")).toBe("123");
    expect(regexFind("z+", "abc")).toBe("");
  });
});
