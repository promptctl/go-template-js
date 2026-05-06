import { describe, expect, it } from "vitest";
import { abbrev } from "./abbrev.js";

describe("sprig.abbrev", () => {
  it("returns input unchanged when shorter than width", () => {
    expect(abbrev(10, "hi")).toBe("hi");
  });
  it("truncates and appends ellipsis when longer", () => {
    expect(abbrev(8, "hello world")).toBe("hello...");
  });
  it("returns input unchanged when width < 4", () => {
    expect(abbrev(2, "hello")).toBe("hello");
  });
});
