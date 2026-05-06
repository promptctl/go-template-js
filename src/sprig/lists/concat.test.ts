import { describe, expect, it } from "vitest";
import { concat } from "./concat.js";

describe("sprig.concat", () => {
  it("flat-concats lists", () => {
    expect(concat([1, 2], [3, 4], [5])).toEqual([1, 2, 3, 4, 5]);
  });
});
