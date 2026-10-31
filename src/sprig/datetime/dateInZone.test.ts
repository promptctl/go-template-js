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

  it("an unknown zone formats as UTC, as Go sprig does, on every call", () => {
    for (let i = 0; i < 2; i++) {
      expect(dateInZone("15:04:05 MST -0700", REF_DATE, "Not/AZone")).toBe("15:04:05 UTC +0000");
    }
    expect(dateInZone("15:04 MST", REF_DATE, "America/New_York")).toBe("10:04 EST");
  });

  it("follows a zone across DST on repeated calls", () => {
    const july = new Date("2006-07-02T15:04:05Z");
    expect(dateInZone("15:04 MST -0700", REF_DATE, "America/New_York")).toBe("10:04 EST -0500");
    expect(dateInZone("15:04 MST -0700", july, "America/New_York")).toBe("11:04 EDT -0400");
  });

  it("keeps a local mean time offset's minutes, truncating seconds as Go does", () => {
    // New York ran on LMT -4:56:02 before 1883.
    const d = new Date("1800-01-01T00:00:00Z");
    expect(dateInZone("2006-01-02 15:04:05 -0700", d, "America/New_York")).toBe(
      "1799-12-31 19:03:58 -0456",
    );
  });

  it("counts 1 BC as year 0, as Go does", () => {
    const d = new Date(0);
    d.setUTCFullYear(0, 0, 1);
    expect(dateInZone("06-01-02 15:04 -0700", d, "UTC")).toBe("00-01-01 00:00 +0000");
  });
});
