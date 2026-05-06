import { describe, expect, it } from "vitest";
import { typeIsLike } from "./typeIsLike.js";

describe("sprig.typeIsLike", () => {
  it("collapses to typeIs in JS (no pointer/value distinction)", () => {
    expect(typeIsLike("number", 42)).toBe(true);
    expect(typeIsLike("array", [1])).toBe(true);
  });
});
