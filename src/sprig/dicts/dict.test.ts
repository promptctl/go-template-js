import { describe, expect, it } from "vitest";
import type { ReferencedArg, ReferencedLiteral } from "../../evaluator/evaluator.js";
import { dict, staticDictEntries } from "./dict.js";

describe("sprig.dict", () => {
  it("builds from alternating key/value pairs", () => {
    expect(dict("a", 1, "b", 2)).toEqual({ a: 1, b: 2 });
  });
  it("empty returns {}", () => {
    expect(dict()).toEqual({});
  });
});

const lit = (value: ReferencedLiteral): ReferencedArg => ({ kind: "literal", value });
const call = (name: string, ...args: ReferencedArg[]): ReferencedArg => ({
  kind: "call",
  name,
  args,
});
const DYNAMIC: ReferencedArg = { kind: "dynamic" };

describe("sprig.staticDictEntries", () => {
  it("reads an all-literal dict call's pairs", () => {
    expect(
      staticDictEntries(call("dict", lit("key"), lit("pickers"), lit("paged"), lit(false))),
    ).toEqual({ key: "pickers", paged: false });
  });

  it("reads an empty dict call as {}", () => {
    expect(staticDictEntries(call("dict"))).toEqual({});
  });

  it("mirrors runtime later-wins on duplicate keys", () => {
    const statically = staticDictEntries(call("dict", lit("k"), lit("a"), lit("k"), lit("b")));
    expect(statically).toEqual({ k: "b" });
    expect(statically).toEqual(dict("k", "a", "k", "b"));
  });

  it("reads a nil value as null", () => {
    expect(staticDictEntries(call("dict", lit("k"), lit(null)))).toEqual({ k: null });
  });

  it("returns null for a dynamic entry — a value is never guessed", () => {
    expect(staticDictEntries(call("dict", lit("key"), DYNAMIC))).toBeNull();
  });

  it("returns null for a nested-call value", () => {
    expect(staticDictEntries(call("dict", lit("k"), call("dict", lit("a"), lit("b"))))).toBeNull();
  });

  it("returns null for a call that is not dict", () => {
    expect(staticDictEntries(call("upper", lit("k")))).toBeNull();
  });

  it("returns null for a non-call argument", () => {
    expect(staticDictEntries(lit("x"))).toBeNull();
    expect(staticDictEntries(DYNAMIC)).toBeNull();
  });

  it("returns null for an incomplete (odd-length) pair list", () => {
    expect(staticDictEntries(call("dict", lit("k")))).toBeNull();
  });

  it("returns null for a non-string key position", () => {
    expect(staticDictEntries(call("dict", lit(1), lit("x")))).toBeNull();
  });
});
