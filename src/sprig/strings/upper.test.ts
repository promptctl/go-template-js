import { describe, expect, it } from "vitest";
import { upper } from "./upper.js";

describe("sprig.upper", () => {
  it("uppercases ASCII strings", () => {
    expect(upper("hello")).toBe("HELLO");
  });
  it("coerces non-strings", () => {
    expect(upper(42)).toBe("42");
  });
});
