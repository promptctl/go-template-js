import { describe, expect, it } from "vitest";
import { lower } from "./lower.js";

describe("sprig.lower", () => {
  it("lowercases ASCII strings", () => {
    expect(lower("HELLO")).toBe("hello");
  });
});
