import { describe, expect, it } from "vitest";
import { toStrings } from "./toStrings.js";

describe("sprig.toStrings", () => {
  it("maps each element through toString", () => {
    expect(toStrings([1, 2, 3])).toEqual(["1", "2", "3"]);
    expect(toStrings(["a", 1, true])).toEqual(["a", "1", "true"]);
  });

  it("produces empty list for empty input", () => {
    expect(toStrings([])).toEqual([]);
  });

  it("renders nil entries as <nil>", () => {
    expect(toStrings([null, undefined, "x"])).toEqual(["<nil>", "<nil>", "x"]);
  });
});
