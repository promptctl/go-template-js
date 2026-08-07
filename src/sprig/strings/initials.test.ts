import { describe, expect, it } from "vitest";
import { initials } from "./initials.js";

describe("sprig.initials", () => {
  it("takes the first character of each word, case preserved (goutils.Initials)", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("foo bar baz")).toBe("fbb");
    expect(initials("  mixed Case  words ")).toBe("mCw");
  });
});
