import { describe, expect, it } from "vitest";
import { compact } from "./compact.js";

describe("sprig.compact", () => {
  it("removes empty values per sprig.empty rules", () => {
    expect(compact([1, 0, "", "x", null, [], undefined])).toEqual([1, "x"]);
  });
});
