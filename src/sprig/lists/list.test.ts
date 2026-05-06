import { describe, expect, it } from "vitest";
import { list } from "./list.js";

describe("sprig.list", () => {
  it("constructs a list from args", () => {
    expect(list(1, 2, 3)).toEqual([1, 2, 3]);
    expect(list()).toEqual([]);
  });
});
