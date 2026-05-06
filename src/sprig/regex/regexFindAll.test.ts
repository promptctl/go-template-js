import { describe, expect, it } from "vitest";
import { regexFindAll } from "./regexFindAll.js";

describe("sprig.regexFindAll", () => {
  it("returns all matches by default (n = -1)", () => {
    expect(regexFindAll("\\d+", "1 22 333", -1)).toEqual(["1", "22", "333"]);
  });
  it("respects an explicit limit", () => {
    expect(regexFindAll("\\d+", "1 22 333", 2)).toEqual(["1", "22"]);
  });
});
