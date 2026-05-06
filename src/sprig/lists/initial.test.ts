import { describe, expect, it } from "vitest";
import { initial } from "./initial.js";

describe("sprig.initial", () => {
  it("all but the last", () => {
    expect(initial([1, 2, 3])).toEqual([1, 2]);
  });
});
