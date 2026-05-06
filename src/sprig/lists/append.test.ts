import { describe, expect, it } from "vitest";
import { append } from "./append.js";

describe("sprig.append", () => {
  it("adds at the end", () => {
    expect(append([1, 2], 3)).toEqual([1, 2, 3]);
  });
});
