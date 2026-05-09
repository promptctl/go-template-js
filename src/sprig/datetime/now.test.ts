import { describe, expect, it } from "vitest";
import { now } from "./now.js";

describe("sprig.now", () => {
  it("returns the result of the clock seam", () => {
    const frozen = new Date("2006-01-02T15:04:05Z");
    expect(now(() => frozen)).toBe(frozen);
  });

  it("uses a different date when clock returns different value", () => {
    const d1 = new Date("2020-01-01T00:00:00Z");
    const d2 = new Date("2024-06-15T12:00:00Z");
    let call = 0;
    const clock = () => (call++ === 0 ? d1 : d2);
    expect(now(clock).getTime()).toBe(d1.getTime());
    expect(now(clock).getTime()).toBe(d2.getTime());
  });
});
