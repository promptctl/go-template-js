import { describe, expect, it } from "vitest";
import { unixEpoch } from "./unixEpoch.js";

describe("sprig.unixEpoch", () => {
  it("returns seconds since epoch as string", () => {
    const d = new Date(1000 * 1000); // 1000 seconds after epoch
    expect(unixEpoch(d)).toBe("1000");
  });

  it("accepts number (unix seconds)", () => {
    expect(unixEpoch(1136239445)).toBe("1136239445");
  });

  it("truncates milliseconds", () => {
    const d = new Date(1000 * 1500 + 999); // 1500.999 seconds → 1500
    expect(unixEpoch(d)).toBe("1500");
  });
});
