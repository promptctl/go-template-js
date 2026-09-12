import { describe, expect, it } from "vitest";
import { trunc } from "./trunc.js";

describe("sprig.trunc", () => {
  it("first N when N positive", () => {
    expect(trunc(3, "abcdef")).toBe("abc");
  });
  it("last |N| when N negative", () => {
    expect(trunc(-2, "hello")).toBe("lo");
  });
  it("returns input unchanged when |N| >= length", () => {
    expect(trunc(99, "hi")).toBe("hi");
    expect(trunc(-99, "hi")).toBe("hi");
  });
  it("counts code points, so an astral char is never split", () => {
    // Go truncates by BYTE and yields the invalid "\xf0" here; a whole
    // rune is the closest well-formed answer. Intended divergence.
    expect(trunc(1, "\u{10348}x")).toBe("\u{10348}");
    expect(trunc(-1, "x\u{10348}")).toBe("\u{10348}");
  });
});
