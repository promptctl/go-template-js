import { describe, expect, it } from "vitest";
import { div } from "./div.js";

describe("sprig.div", () => {
  it("truncates toward zero (Go semantics)", () => {
    expect(div(10, 3)).toBe(3);
    expect(div(-10, 3)).toBe(-3);
  });
});
