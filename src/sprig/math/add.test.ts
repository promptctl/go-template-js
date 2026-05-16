import { describe, expect, it } from "vitest";
import { add } from "./add.js";

describe("sprig.add", () => {
  it("variadic integer sum", () => {
    expect(add(1, 2, 3)).toBe(6);
    expect(add()).toBe(0);
  });
});
