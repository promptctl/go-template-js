import { describe, expect, it } from "vitest";
import { trim } from "./trim.js";

describe("sprig.trim", () => {
  it("strips leading and trailing whitespace", () => {
    expect(trim("  hi  ")).toBe("hi");
    expect(trim("\n\thi\n")).toBe("hi");
  });
});
