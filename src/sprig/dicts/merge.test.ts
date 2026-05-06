import { describe, expect, it } from "vitest";
import { merge } from "./merge.js";

describe("sprig.merge", () => {
  it("dst keys win; sources fill in missing", () => {
    expect(merge({ a: 1 }, { a: 99, b: 2 }, { c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });
});
