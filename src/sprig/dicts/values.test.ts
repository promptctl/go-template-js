import { describe, expect, it } from "vitest";
import { values } from "./values.js";

describe("sprig.values", () => {
  it("plain object", () => {
    expect(values({ a: 1, b: 2 })).toEqual([1, 2]);
  });
});
