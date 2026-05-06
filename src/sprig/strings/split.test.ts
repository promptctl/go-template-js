import { describe, expect, it } from "vitest";
import { split } from "./split.js";

describe("sprig.split", () => {
  it("returns a dict keyed by _<index>", () => {
    expect(split("/", "a/b/c")).toEqual({ _0: "a", _1: "b", _2: "c" });
  });
});
