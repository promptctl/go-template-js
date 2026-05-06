import { describe, expect, it } from "vitest";
import { quote } from "./quote.js";

describe("sprig.quote", () => {
  it("wraps args in double quotes joined by spaces", () => {
    expect(quote("a", "b")).toBe('"a" "b"');
  });
});
