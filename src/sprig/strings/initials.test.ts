import { describe, expect, it } from "vitest";
import { initials } from "./initials.js";

describe("sprig.initials", () => {
  it("takes the first character of each word, case preserved (goutils.Initials)", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("foo bar baz")).toBe("fbb");
    expect(initials("  mixed Case  words ")).toBe("mCw");
  });

  it("is byte-faithful to Go on multi-byte leading characters", () => {
    // Go takes the word's first UTF-8 byte as the initial (generator-verified):
    // "Ölga" (C3 96...) -> U+00C3 "Ã"; "𐍈foo" (F0 90 8D 88...) -> U+00F0 "ð".
    expect(initials("Ölga foo")).toBe("Ãf");
    expect(initials("𐍈foo bar")).toBe("ðb");
  });
});
