import { describe, expect, it } from "vitest";
import { sha512sum } from "./sha512sum.js";

describe("sprig.sha512sum", () => {
  it("matches known SHA-512 digest for 'hello'", () => {
    expect(sha512sum("hello")).toBe(
      "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043",
    );
  });

  it("matches known SHA-512 digest for empty string", () => {
    expect(sha512sum("")).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    );
  });

  it("returns lowercase hex of exactly 128 characters", () => {
    const result = sha512sum("anything");
    expect(result).toHaveLength(128);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
