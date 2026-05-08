import { describe, expect, it } from "vitest";
import { plural } from "./plural.js";

describe("sprig.plural", () => {
  it("returns `one` when n == 1", () => {
    expect(plural("apple", "apples", 1)).toBe("apple");
  });

  it("returns `many` for any n != 1 (including 0 and negative)", () => {
    expect(plural("apple", "apples", 0)).toBe("apples");
    expect(plural("apple", "apples", 2)).toBe("apples");
    expect(plural("apple", "apples", -1)).toBe("apples");
  });

  it("treats 1n (bigint) as singular for parity with int slot", () => {
    expect(plural("apple", "apples", 1n)).toBe("apple");
    expect(plural("apple", "apples", 2n)).toBe("apples");
  });
});
