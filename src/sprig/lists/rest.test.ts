import { describe, expect, it } from "vitest";
import { rest } from "./rest.js";

describe("sprig.rest", () => {
  it("all but the first", () => {
    expect(rest([1, 2, 3])).toEqual([2, 3]);
  });
});
