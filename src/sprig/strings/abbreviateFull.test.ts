import { describe, expect, it } from "vitest";
import { abbreviateFull } from "./abbreviateFull.js";
import { runes } from "./runes.js";

// The output is pinned against Go by the sprig-abbrevboth-goutils-branches
// fixture; these are the error arms the sprig wrappers never reach.
describe("abbreviateFull", () => {
  it("refuses a width below 4, as goutils does", () => {
    expect(() => abbreviateFull(runes("abcdefghijklmn"), 0, 2)).toThrow(/width is 4/);
  });
  it("refuses a width below 7 once the offset leaves the head, as goutils does", () => {
    expect(() => abbreviateFull(runes("abcdefghijklmn"), 5, 5)).toThrow(/with offset is 7/);
  });
});
