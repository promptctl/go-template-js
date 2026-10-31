import { describe, expect, it } from "vitest";
import { abbrevboth } from "./abbrevboth.js";

describe("sprig.abbrevboth", () => {
  it("returns input unchanged when too short for the spec", () => {
    expect(abbrevboth(0, 6, "hi")).toBe("hi");
  });
  it("keeps the head with no leading ellipsis when the offset is 4 or less", () => {
    expect(abbrevboth(2, 9, "hello world")).toBe("hello ...");
  });
  it("counts code points, so an astral char is never split", () => {
    expect(abbrevboth(5, 10, "abcde\u{10348}ghijklmnop")).toBe("...\u{10348}ghi...");
  });
});
