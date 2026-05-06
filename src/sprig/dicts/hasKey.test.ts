import { describe, expect, it } from "vitest";
import { hasKey } from "./hasKey.js";

describe("sprig.hasKey", () => {
  it("checks key presence", () => {
    expect(hasKey({ a: 1 }, "a")).toBe(true);
    expect(hasKey({ a: 1 }, "b")).toBe(false);
  });
});
