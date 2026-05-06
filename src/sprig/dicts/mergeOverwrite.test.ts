import { describe, expect, it } from "vitest";
import { mergeOverwrite } from "./mergeOverwrite.js";

describe("sprig.mergeOverwrite", () => {
  it("later sources overwrite earlier values", () => {
    expect(mergeOverwrite({ a: 1 }, { a: 99, b: 2 })).toEqual({ a: 99, b: 2 });
  });
});
