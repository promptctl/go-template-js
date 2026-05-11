import { describe, expect, it } from "vitest";
import { dateInZone } from "./dateInZone.js";

// Go's reference time as a UTC Date.
const REF_DATE = new Date("2006-01-02T15:04:05Z");

describe("sprig.dateInZone", () => {
  it("formats RFC3339 in UTC", () => {
    expect(dateInZone("2006-01-02T15:04:05Z07:00", REF_DATE, "UTC")).toBe("2006-01-02T15:04:05Z");
  });

  it("htmlDate in UTC", () => {
    expect(dateInZone("2006-01-02", REF_DATE, "UTC")).toBe("2006-01-02");
  });

  it("formats time components", () => {
    expect(dateInZone("15:04:05", REF_DATE, "UTC")).toBe("15:04:05");
  });

  it("formats in New York (EST = UTC-5)", () => {
    // 2006-01-02 is in January → EST (-5h)
    // 15:04:05 UTC → 10:04:05 EST
    const result = dateInZone("15:04:05", REF_DATE, "America/New_York");
    expect(result).toBe("10:04:05");
  });

  it("month name in UTC", () => {
    expect(dateInZone("January 2006", REF_DATE, "UTC")).toBe("January 2006");
  });

  it("unixEpoch round-trip via dateInZone", () => {
    const d = new Date(1_000_000_000 * 1000); // 2001-09-09T01:46:40Z
    expect(dateInZone("2006-01-02", d, "UTC")).toBe("2001-09-09");
  });

  it("accepts number (unix seconds)", () => {
    // 1136239445 = 2006-01-02T15:04:05Z
    expect(dateInZone("2006-01-02", 1136239445, "UTC")).toBe("2006-01-02");
  });
});
