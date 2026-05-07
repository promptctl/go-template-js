import { describe, expect, it } from "vitest";
import { set } from "./set.js";

describe("sprig.set", () => {
  it("mutates the receiver and returns it (Go sprig parity)", () => {
    const original = { a: 1 } as Record<string, unknown>;
    const next = set(original, "b", 2);
    expect(next).toBe(original);
    expect(original).toEqual({ a: 1, b: 2 });
  });

  it("overwrites an existing key in place", () => {
    const d = { a: 1 } as Record<string, unknown>;
    set(d, "a", 99);
    expect(d).toEqual({ a: 99 });
  });
});
