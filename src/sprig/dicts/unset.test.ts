import { describe, expect, it } from "vitest";
import { unset } from "./unset.js";

describe("sprig.unset", () => {
  it("removes the key", () => {
    expect(unset({ a: 1, b: 2 }, "a")).toEqual({ b: 2 });
  });
});
