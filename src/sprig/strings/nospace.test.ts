import { describe, expect, it } from "vitest";
import { nospace } from "./nospace.js";

describe("sprig.nospace", () => {
  it("removes spaces, tabs, and newlines", () => {
    expect(nospace("hello world")).toBe("helloworld");
    expect(nospace("a\tb\nc\rd")).toBe("abcd");
    expect(nospace("  leading and trailing  ")).toBe("leadingandtrailing");
  });

  it("returns empty for whitespace-only input", () => {
    expect(nospace("   \t\n")).toBe("");
  });

  it("passes through input with no whitespace unchanged", () => {
    expect(nospace("foo")).toBe("foo");
    expect(nospace("")).toBe("");
  });
});
