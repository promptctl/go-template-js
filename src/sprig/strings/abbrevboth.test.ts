import { describe, expect, it } from "vitest";
import { abbrevboth } from "./abbrevboth.js";

describe("sprig.abbrevboth", () => {
  it("returns input unchanged when too short for the spec", () => {
    expect(abbrevboth(0, 6, "hi")).toBe("hi");
  });
  it("returns ...slice... around a window when valid", () => {
    expect(abbrevboth(2, 9, "hello world")).toBe("...llo...");
  });
});
