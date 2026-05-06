import { describe, expect, it } from "vitest";
import { repeat } from "./repeat.js";

describe("sprig.repeat", () => {
  it("repeats N times", () => {
    expect(repeat(3, "ab")).toBe("ababab");
    expect(repeat(0, "x")).toBe("");
  });
  it("clamps negative N to 0", () => {
    expect(repeat(-2, "x")).toBe("");
  });
});
