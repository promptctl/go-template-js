import { describe, expect, it } from "vitest";
import { keys } from "./keys.js";

describe("sprig.keys", () => {
  it("plain object", () => {
    expect(keys({ a: 1, b: 2 })).toEqual(["a", "b"]);
  });
});
