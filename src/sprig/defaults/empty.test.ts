import { describe, expect, it } from "vitest";
import { empty } from "./empty.js";

describe("sprig.empty", () => {
  it.each([
    [null, true],
    [undefined, true],
    [false, true],
    [0, true],
    [0.0, true],
    [0n, true],
    [Number.NaN, true],
    ["", true],
    [[], true],
    [new Map(), true],
    [new Set(), true],
    [{}, true],
    [true, false],
    [1, false],
    [1n, false],
    ["x", false],
    [[0], false],
    [{ a: 0 }, false],
    [new Map([["k", 0]]), false],
  ])("empty(%p) = %s", (value, expected) => {
    expect(empty(value)).toBe(expected);
  });
});
