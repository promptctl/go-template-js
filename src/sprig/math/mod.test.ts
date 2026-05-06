import { describe, expect, it } from "vitest";
import { mod } from "./mod.js";

describe("sprig.mod", () => {
  it("sign follows dividend (Go semantics)", () => {
    expect(mod(10, 3)).toBe(1);
    expect(mod(-10, 3)).toBe(-1);
  });
});
