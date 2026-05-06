import { describe, expect, it } from "vitest";
import { initials } from "./initials.js";

describe("sprig.initials", () => {
  it("takes first letter of each word, uppercased", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("foo bar baz")).toBe("FBB");
  });
});
