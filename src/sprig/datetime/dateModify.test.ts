import { describe, expect, it } from "vitest";
import { dateModify } from "./dateModify.js";

const BASE = new Date("2006-01-02T15:04:05Z");

describe("sprig.dateModify", () => {
  it("adds 1 hour", () => {
    const result = dateModify("1h", BASE);
    expect(result.getUTCHours()).toBe(16);
  });

  it("subtracts 24 hours", () => {
    const result = dateModify("-24h", BASE);
    expect(result.getUTCDate()).toBe(1); // Jan 1
  });

  it("adds 30 minutes", () => {
    const result = dateModify("30m", BASE);
    expect(result.getUTCMinutes()).toBe(34);
  });

  it("adds 0 duration", () => {
    const result = dateModify("0", BASE);
    expect(result.getTime()).toBe(BASE.getTime());
  });

  it("returns original date on invalid duration (mirrors Go sprig)", () => {
    expect(dateModify("bad", BASE).getTime()).toBe(BASE.getTime());
  });
});
