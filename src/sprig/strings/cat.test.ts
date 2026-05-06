import { describe, expect, it } from "vitest";
import { cat } from "./cat.js";

describe("sprig.cat", () => {
  it("space-joins all args", () => {
    expect(cat("a", "b", "c")).toBe("a b c");
  });
});
