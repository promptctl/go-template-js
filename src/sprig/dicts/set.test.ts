import { describe, expect, it } from "vitest";
import { set } from "./set.js";

describe("sprig.set", () => {
  it("returns a new dict with key=value", () => {
    const original = { a: 1 };
    const next = set(original, "b", 2);
    expect(next).toEqual({ a: 1, b: 2 });
    expect(original).toEqual({ a: 1 });
  });
});
