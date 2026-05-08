import { describe, expect, it } from "vitest";
import { splitn } from "./splitn.js";

describe("sprig.splitn", () => {
  it("splits into n parts with the last holding the unsplit remainder", () => {
    expect(splitn(",", 3, "a,b,c,d")).toEqual({ _0: "a", _1: "b", _2: "c,d" });
  });

  it("returns all parts when n is greater than or equal to the natural count", () => {
    expect(splitn(",", 5, "a,b")).toEqual({ _0: "a", _1: "b" });
  });

  it("returns an empty map when n is 0 (Go SplitN parity)", () => {
    expect(splitn(",", 0, "a,b,c")).toEqual({});
  });

  it("returns all parts when n is negative (Go SplitN parity)", () => {
    expect(splitn(",", -1, "a,b,c")).toEqual({ _0: "a", _1: "b", _2: "c" });
  });

  it("returns a single-entry map when n=1 holding the whole input", () => {
    expect(splitn(",", 1, "a,b,c")).toEqual({ _0: "a,b,c" });
  });

  it("preserves the `_<index>` key shape, not numeric indices", () => {
    const out = splitn(":", 2, "key:value");
    expect(Object.keys(out)).toEqual(["_0", "_1"]);
  });

  it("accepts bigint n via the `int` slot", () => {
    expect(splitn(",", 2n, "a,b,c")).toEqual({ _0: "a", _1: "b,c" });
  });
});
