import { describe, expect, it } from "vitest";
import { floor } from "./floor.js";

describe("sprig.floor", () => {
  it("rounds down", () => {
    expect(floor(1.9)).toBe(1);
    expect(floor(-0.5)).toBe(-1);
  });
});
