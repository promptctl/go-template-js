import { describe, expect, it } from "vitest";
import { substr } from "./substr.js";

describe("sprig.substr", () => {
  it("slice with explicit start and end", () => {
    expect(substr(1, 4, "abcdef")).toBe("bcd");
  });
  it("clamps out-of-range end", () => {
    expect(substr(1, 99, "abcd")).toBe("bcd");
  });
});
