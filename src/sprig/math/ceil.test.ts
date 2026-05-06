import { describe, expect, it } from "vitest";
import { ceil } from "./ceil.js";

describe("sprig.ceil", () => {
  it("rounds up", () => {
    expect(ceil(1.1)).toBe(2);
    expect(ceil(-0.5)).toBe(-0);
  });
});
