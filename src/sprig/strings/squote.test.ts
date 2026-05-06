import { describe, expect, it } from "vitest";
import { squote } from "./squote.js";

describe("sprig.squote", () => {
  it("wraps args in single quotes joined by spaces", () => {
    expect(squote("a", "b")).toBe("'a' 'b'");
  });
});
