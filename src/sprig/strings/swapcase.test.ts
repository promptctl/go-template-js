import { describe, expect, it } from "vitest";
import { swapcase } from "./swapcase.js";

describe("sprig.swapcase", () => {
  it("flips upper to lower and lower to upper", () => {
    // "Hello": H is upper → h; e,l,l,o are lower → E,L,L,O.
    expect(swapcase("Hello")).toBe("hELLO");
  });

  it("flips both halves of a multi-word string and preserves spaces", () => {
    expect(swapcase("hello world")).toBe("HELLO WORLD");
    expect(swapcase("HELLO WORLD")).toBe("hello world");
  });

  it("returns empty string unchanged", () => {
    expect(swapcase("")).toBe("");
  });

  it("passes punctuation and digits through unchanged", () => {
    expect(swapcase("a.b")).toBe("A.B");
    expect(swapcase("Mix3d")).toBe("mIX3D");
  });
});
