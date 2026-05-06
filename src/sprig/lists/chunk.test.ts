import { describe, expect, it } from "vitest";
import { chunk } from "./chunk.js";

describe("sprig.chunk", () => {
  it("splits into chunks of size N", () => {
    expect(chunk(2, [1, 2, 3, 4, 5])).toEqual([[1, 2], [3, 4], [5]]);
  });
});
