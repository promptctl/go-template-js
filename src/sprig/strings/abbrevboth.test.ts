import { describe, expect, it } from "vitest";
import { abbrevboth } from "./abbrevboth.js";

describe("sprig.abbrevboth", () => {
  it("returns input unchanged when too short for the spec", () => {
    expect(abbrevboth(0, 6, "hi")).toBe("hi");
  });
  it("returns ...slice... around a window when valid", () => {
    expect(abbrevboth(2, 9, "hello world")).toBe("...llo...");
  });
  it("counts code points, so an astral char is never split", () => {
    expect(abbrevboth(5, 10, "abcde\u{10348}ghijklmnop")).toBe("...\u{10348}ghi...");
  });
});
