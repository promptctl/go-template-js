import { describe, expect, it } from "vitest";
import { substr } from "./substr.js";

describe("sprig.substr", () => {
  it("slice with explicit start and end", () => {
    expect(substr(1, 4, "abcdef")).toBe("bcd");
  });
  it("clamps out-of-range end", () => {
    expect(substr(1, 99, "abcd")).toBe("bcd");
  });
  it("clamps negative end to s.length (Go sprig parity)", () => {
    expect(substr(1, -3, "abcdef")).toBe("bcdef");
    expect(substr(0, -1, "abcdef")).toBe("abcdef");
  });
  it("clamps negative start to 0", () => {
    expect(substr(-2, 3, "abcdef")).toBe("abc");
  });
});
