import { describe, expect, it } from "vitest";
import { seq } from "./seq.js";

// Behavioural parity with Go sprig's `seq`. Note: Go's seq is
// **inclusive** of the end value — this is the surprising bit. Tests
// here pin the inclusivity contract; the conformance fixture
// `sprig-seq-arities` cross-checks against Go's reference output.
describe("sprig.seq", () => {
  it("zero args returns empty string", () => {
    expect(seq()).toBe("");
  });

  it("single arg counts up from 1, inclusive of end", () => {
    expect(seq(5)).toBe("1 2 3 4 5");
    expect(seq(1)).toBe("1");
  });

  it("single arg with negative end counts down from 1, inclusive", () => {
    expect(seq(-3)).toBe("1 0 -1 -2 -3");
  });

  it("two args step ±1 by direction, inclusive of end", () => {
    expect(seq(2, 6)).toBe("2 3 4 5 6");
    expect(seq(5, 1)).toBe("5 4 3 2 1");
    expect(seq(3, 3)).toBe("3");
  });

  it("three args use explicit step, inclusive when reached", () => {
    expect(seq(1, 2, 9)).toBe("1 3 5 7 9");
    expect(seq(10, -3, 0)).toBe("10 7 4 1");
  });

  it("three args descending with positive step returns empty", () => {
    // Go: `if end < start { increment = -1; if step > 0 { return "" } }`
    expect(seq(5, 1, 1)).toBe("");
    expect(seq(5, 2, 1)).toBe("");
  });

  it("step=0 with ascending bounds yields empty (untilStep guard)", () => {
    expect(seq(1, 0, 5)).toBe("");
  });

  it("4+ args returns empty string", () => {
    expect(seq(1, 2, 3, 4)).toBe("");
  });

  it("truncates fractional inputs", () => {
    // (1, 2, 5): ascending with step 2, end inclusive → [1, 3, 5]
    expect(seq(1.7, 2.4, 5.9)).toBe("1 3 5");
  });
});
