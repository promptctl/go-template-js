import { describe, expect, it } from "vitest";
import { sha256sum } from "./sha256sum.js";

describe("sprig.sha256sum", () => {
  it("matches known SHA-256 digest for 'hello'", () => {
    expect(sha256sum("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("matches known SHA-256 digest for empty string", () => {
    expect(sha256sum("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("returns lowercase hex of exactly 64 characters", () => {
    const result = sha256sum("anything");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
