import { describe, expect, it } from "vitest";
import { trimAll } from "./trimAll.js";

describe("sprig.trimAll", () => {
  it("strips chars in cutset from both ends", () => {
    expect(trimAll("$/", "$$path/")).toBe("path");
  });
  it("returns input unchanged when cutset is empty", () => {
    expect(trimAll("", "  hi  ")).toBe("  hi  ");
  });
});
