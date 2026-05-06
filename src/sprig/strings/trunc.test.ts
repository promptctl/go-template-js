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
});
