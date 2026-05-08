import { describe, expect, it } from "vitest";
import { atoi } from "./atoi.js";

describe("sprig.atoi", () => {
  it("parses base-10 integers", () => {
    expect(atoi("42")).toBe(42);
    expect(atoi("-7")).toBe(-7);
    expect(atoi("+7")).toBe(7);
    expect(atoi("0")).toBe(0);
  });

  it("returns 0 for non-parseable input (Go discards err)", () => {
    expect(atoi("abc")).toBe(0);
    expect(atoi("")).toBe(0);
    expect(atoi("3.14")).toBe(0);
    expect(atoi("12x")).toBe(0);
  });

  it("does not accept hex/octal prefixes (use toDecimal for that)", () => {
    expect(atoi("0xff")).toBe(0);
    expect(atoi("0755")).toBe(755);
  });
});
