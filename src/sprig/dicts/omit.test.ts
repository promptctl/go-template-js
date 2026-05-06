import { describe, expect, it } from "vitest";
import { omit } from "./omit.js";

describe("sprig.omit", () => {
  it("drops the named keys", () => {
    expect(omit({ a: 1, b: 2, c: 3 }, "b")).toEqual({ a: 1, c: 3 });
  });
});
