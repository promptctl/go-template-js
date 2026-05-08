import { describe, expect, it } from "vitest";
import { toDecimal } from "./toDecimal.js";

describe("sprig.toDecimal", () => {
  it("parses base-8 (octal) strings — that's the whole job", () => {
    expect(toDecimal("0755")).toBe(493);
    expect(toDecimal("755")).toBe(493);
    expect(toDecimal("0")).toBe(0);
    expect(toDecimal("-0777")).toBe(-511);
    expect(toDecimal("+10")).toBe(8);
  });

  it("does NOT detect 0x/0b/0o prefixes (Go hard-codes base 8)", () => {
    expect(toDecimal("0xff")).toBe(0);
    expect(toDecimal("0o755")).toBe(0);
    expect(toDecimal("0b1010")).toBe(0);
  });

  it("rejects non-octal digits", () => {
    expect(toDecimal("08")).toBe(0);
    expect(toDecimal("9")).toBe(0);
    expect(toDecimal("abc")).toBe(0);
    expect(toDecimal("")).toBe(0);
    expect(toDecimal("3.14")).toBe(0);
  });
});
