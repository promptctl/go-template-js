import { describe, expect, it } from "vitest";
import { b32dec } from "./b32dec.js";
import { b32enc } from "./b32enc.js";

describe("sprig.b32dec", () => {
  it("matches RFC 4648 test vectors", () => {
    expect(b32dec("")).toBe("");
    expect(b32dec("MY======")).toBe("f");
    expect(b32dec("MZXQ====")).toBe("fo");
    expect(b32dec("MZXW6===")).toBe("foo");
    expect(b32dec("MZXW6YQ=")).toBe("foob");
    expect(b32dec("MZXW6YTBOI======")).toBe("foobar");
  });

  it("round-trips through b32enc", () => {
    for (const s of ["hello", "foo bar", "12345"]) {
      expect(b32dec(b32enc(s))).toBe(s);
    }
  });

  it("is case-insensitive", () => {
    expect(b32dec("mzxw6===")).toBe("foo");
    expect(b32dec("MZXW6===")).toBe("foo");
  });

  it("throws on invalid characters", () => {
    expect(() => b32dec("!!!!=====")).toThrow("invalid character");
  });
});
