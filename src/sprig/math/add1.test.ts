import { describe, expect, it } from "vitest";
import { add1 } from "./add1.js";

describe("sprig.add1", () => {
  it("integer increment", () => {
    expect(add1(0)).toBe(1);
    expect(add1(41)).toBe(42);
    expect(add1(-5)).toBe(-4);
  });
});
