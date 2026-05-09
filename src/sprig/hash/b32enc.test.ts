import { describe, expect, it } from "vitest";
import { b32enc } from "./b32enc.js";

// RFC 4648 §10 test vectors
describe("sprig.b32enc", () => {
  it("matches RFC 4648 test vectors", () => {
    expect(b32enc("")).toBe("");
    expect(b32enc("f")).toBe("MY======");
    expect(b32enc("fo")).toBe("MZXQ====");
    expect(b32enc("foo")).toBe("MZXW6===");
    expect(b32enc("foob")).toBe("MZXW6YQ=");
    expect(b32enc("foobar")).toBe("MZXW6YTBOI======");
  });

  it("uses uppercase A-Z2-7 alphabet", () => {
    expect(b32enc("hello")).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("output is always a multiple of 8 characters", () => {
    for (let len = 0; len <= 10; len++) {
      const s = "x".repeat(len);
      expect(b32enc(s).length % 8).toBe(0);
    }
  });
});
