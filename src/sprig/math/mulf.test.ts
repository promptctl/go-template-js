import { describe, expect, it } from "vitest";
import { mulf } from "./mulf.js";

describe("sprig.mulf", () => {
  it("float product", () => {
    expect(mulf(1.5, 2)).toBe(3);
  });
});
