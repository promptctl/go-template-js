import { describe, expect, it } from "vitest";
import { createEngine } from "./index.js";

describe("createEngine", () => {
  it("returns the default engine name", () => {
    expect(createEngine().name).toBe("go-template-js");
  });

  it("respects an explicit name", () => {
    expect(createEngine({ name: "custom" }).name).toBe("custom");
  });
});
