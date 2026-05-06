import { describe, expect, it } from "vitest";
import { splitList } from "./splitList.js";

describe("sprig.splitList", () => {
  it("returns a list", () => {
    expect(splitList("/", "a/b/c")).toEqual(["a", "b", "c"]);
  });
});
