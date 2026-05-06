import { describe, expect, it } from "vitest";
import { prepend } from "./prepend.js";

describe("sprig.prepend", () => {
  it("adds at the front", () => {
    expect(prepend([2, 3], 1)).toEqual([1, 2, 3]);
  });
});
