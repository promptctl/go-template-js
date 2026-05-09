import { describe, expect, it } from "vitest";
import { duration } from "./duration.js";

// Go sprig's duration accepts strings (parsed as integer seconds).
// Passing a number also works in JS; Go template integer literals
// hit a default-zero branch in sprig (only string and int64 are handled).
describe("sprig.duration", () => {
  it("string '0' → '0s'", () => expect(duration("0")).toBe("0s"));
  it("string '5' → '5s'", () => expect(duration("5")).toBe("5s"));
  it("string '60' → '1m0s'", () => expect(duration("60")).toBe("1m0s"));
  it("string '65' → '1m5s'", () => expect(duration("65")).toBe("1m5s"));
  it("string '3600' → '1h0m0s'", () => expect(duration("3600")).toBe("1h0m0s"));
  it("string '3661' → '1h1m1s'", () => expect(duration("3661")).toBe("1h1m1s"));
  it("number 3600 → '1h0m0s'", () => expect(duration(3600)).toBe("1h0m0s"));
  it("bigint 3600n → '1h0m0s'", () => expect(duration(3600n)).toBe("1h0m0s"));
  it("invalid string → '0s'", () => expect(duration("bad")).toBe("0s"));
});
