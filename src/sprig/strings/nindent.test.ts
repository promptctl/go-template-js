import { describe, expect, it } from "vitest";
import { nindent } from "./nindent.js";

describe("sprig.nindent", () => {
  it("indents with a leading newline", () => {
    expect(nindent(2, "a\nb")).toBe("\n  a\n  b");
  });
});
