import { describe, expect, it } from "vitest";
import { add1 } from "./add1.js";

describe("sprig.add1", () => {
  it("integer increment", () => {
    expect(add1(0)).toBe(1);
    expect(add1(41)).toBe(42);
    expect(add1(-5)).toBe(-4);
  });
  it("truncates fractional input before adding one", () => {
    expect(add1(1.9)).toBe(2);
    expect(add1(-1.9)).toBe(0);
  });
  it("accepts bigint via the number slot", () => {
    expect(add1(7n)).toBe(8);
  });
});
