import { describe, expect, it } from "vitest";
import { typeIs } from "./typeIs.js";

describe("sprig.typeIs", () => {
  it("string compare against typeOf", () => {
    expect(typeIs("number", 42)).toBe(true);
    expect(typeIs("array", [1, 2])).toBe(true);
  });
});
