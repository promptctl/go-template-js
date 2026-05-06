import { describe, expect, it } from "vitest";
import { ternary } from "./ternary.js";

describe("sprig.ternary", () => {
  it("returns trueVal when cond is truthy", () => {
    expect(ternary("YES", "NO", true)).toBe("YES");
    expect(ternary("YES", "NO", "x")).toBe("YES");
    expect(ternary("YES", "NO", 1)).toBe("YES");
  });

  it("returns falseVal when cond is falsy", () => {
    expect(ternary("YES", "NO", false)).toBe("NO");
    expect(ternary("YES", "NO", "")).toBe("NO");
    expect(ternary("YES", "NO", 0)).toBe("NO");
    expect(ternary("YES", "NO", null)).toBe("NO");
  });
});
