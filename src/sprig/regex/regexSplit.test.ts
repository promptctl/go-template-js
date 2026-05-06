import { describe, expect, it } from "vitest";
import { regexSplit } from "./regexSplit.js";

describe("sprig.regexSplit", () => {
  it("splits by pattern; n = -1 returns all parts", () => {
    expect(regexSplit("\\s+", "a b  c", -1)).toEqual(["a", "b", "c"]);
  });
  it("respects an explicit max count", () => {
    expect(regexSplit("\\s+", "a b c d", 2)).toEqual(["a", "b"]);
  });
});
