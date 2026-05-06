import { describe, expect, it } from "vitest";
import { indent } from "./indent.js";

describe("sprig.indent", () => {
  it("prefixes every line with N spaces", () => {
    expect(indent(2, "a\nb")).toBe("  a\n  b");
  });
});
