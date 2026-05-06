import { describe, expect, it } from "vitest";
import { last } from "./last.js";

describe("sprig.last", () => {
  it("last element of array", () => {
    expect(last([1, 2, 3])).toBe(3);
  });
});
