import { describe, expect, it } from "vitest";
import { pick } from "./pick.js";

describe("sprig.pick", () => {
  it("keeps only the named keys", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, "a", "c")).toEqual({ a: 1, c: 3 });
  });
});
