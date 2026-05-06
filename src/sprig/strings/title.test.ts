import { describe, expect, it } from "vitest";
import { title } from "./title.js";

describe("sprig.title", () => {
  it("capitalizes the first letter of each word", () => {
    expect(title("hello world")).toBe("Hello World");
  });
});
