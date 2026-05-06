import { describe, expect, it } from "vitest";
import { typeOf } from "./typeOf.js";

describe("sprig.typeOf", () => {
  it("matches kindOf for JS", () => {
    expect(typeOf(42)).toBe("number");
    expect(typeOf("x")).toBe("string");
  });
});
