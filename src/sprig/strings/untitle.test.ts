import { describe, expect, it } from "vitest";
import { untitle } from "./untitle.js";

describe("sprig.untitle", () => {
  it("lowercases the first letter of each word", () => {
    expect(untitle("Hello World")).toBe("hello world");
  });
});
