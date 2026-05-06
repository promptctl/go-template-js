import { describe, expect, it } from "vitest";
import { kindOf } from "./kindOf.js";

describe("sprig.kindOf", () => {
  it.each([
    ["", "string"],
    [42, "number"],
    [42n, "bigint"],
    [true, "boolean"],
    [[], "array"],
    [{}, "object"],
    [new Map(), "map"],
    [new Set(), "set"],
    [null, "null"],
    [undefined, "undefined"],
    [() => 0, "function"],
  ])("kindOf(%p) = %s", (v, expected) => {
    expect(kindOf(v)).toBe(expected);
  });
});
