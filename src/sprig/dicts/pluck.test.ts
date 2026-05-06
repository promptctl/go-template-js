import { describe, expect, it } from "vitest";
import { pluck } from "./pluck.js";

describe("sprig.pluck", () => {
  it("collects key from each dict that has it", () => {
    expect(pluck("name", { name: "a" }, { name: "b" }, { other: "c" })).toEqual(["a", "b"]);
  });
});
