import { describe, expect, it } from "vitest";
import { sha1sum } from "./sha1sum.js";

describe("sprig.sha1sum", () => {
  it("matches known SHA-1 digest for 'hello'", () => {
    expect(sha1sum("hello")).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });

  it("matches known SHA-1 digest for empty string", () => {
    expect(sha1sum("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it("returns lowercase hex of exactly 40 characters", () => {
    const result = sha1sum("anything");
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
