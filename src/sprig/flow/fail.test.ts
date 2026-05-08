import { describe, expect, it } from "vitest";
import { EvalError, FailError } from "../../errors.js";
import { fail } from "./fail.js";

describe("sprig.fail", () => {
  it("throws FailError with the given message", () => {
    expect(() => fail("something went wrong")).toThrow(FailError);
    expect(() => fail("something went wrong")).toThrow("something went wrong");
  });

  it("thrown error has kind FailError", () => {
    let caught: unknown;
    try {
      fail("test");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(FailError);
    expect((caught as FailError).kind).toBe("FailError");
  });

  it("FailError is instanceof EvalError", () => {
    let caught: unknown;
    try {
      fail("test");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EvalError);
  });
});
