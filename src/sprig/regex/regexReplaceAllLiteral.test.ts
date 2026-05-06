import { describe, expect, it } from "vitest";
import { regexReplaceAllLiteral } from "./regexReplaceAllLiteral.js";

describe("sprig.regexReplaceAllLiteral", () => {
  it("treats $1 etc. as literal text", () => {
    expect(regexReplaceAllLiteral("(\\d+)", "1 2 3", "$1")).toBe("$1 $1 $1");
  });
});
