import { describe, expect, it } from "vitest";
import { get } from "./get.js";

describe("sprig.get", () => {
  it("plain object", () => {
    expect(get({ a: 1 }, "a")).toBe(1);
    expect(get({ a: 1 }, "b")).toBeUndefined();
  });
  it("Map", () => {
    expect(get(new Map([["a", 1]]), "a")).toBe(1);
  });
});
