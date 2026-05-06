import { describe, expect, it } from "vitest";
import { regexReplaceAll } from "./regexReplaceAll.js";

describe("sprig.regexReplaceAll", () => {
  it("replaces all matches with the replacement string (with $1 expansion)", () => {
    expect(regexReplaceAll("(\\d+)", "1 22 333", "[$1]")).toBe("[1] [22] [333]");
  });
});
