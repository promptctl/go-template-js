import { describe, expect, it } from "vitest";
import { reverse } from "./reverse.js";

describe("sprig.reverse", () => {
  it("reverses without mutating the input", () => {
    const a = [1, 2, 3];
    expect(reverse(a)).toEqual([3, 2, 1]);
    expect(a).toEqual([1, 2, 3]);
  });
});
