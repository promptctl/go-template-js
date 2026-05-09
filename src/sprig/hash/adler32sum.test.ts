import { describe, expect, it } from "vitest";
import { adler32sum } from "./adler32sum.js";

describe("sprig.adler32sum", () => {
  it("matches known Adler-32 value for 'Wikipedia'", () => {
    // Wikipedia's own test vector: 0x11E60398 = 300286872
    expect(adler32sum("Wikipedia")).toBe("300286872");
  });

  it("matches known value for 'hello'", () => {
    // a=533, b=1580 → (1580*65536 + 533) = 103547413
    expect(adler32sum("hello")).toBe("103547413");
  });

  it("returns '1' for empty string (identity value)", () => {
    expect(adler32sum("")).toBe("1");
  });

  it("returns a decimal string (not hex)", () => {
    expect(adler32sum("test")).toMatch(/^\d+$/);
  });
});
