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

  it("formats a UTC offset name as UTC, since Go cannot load it as a zone", () => {
    expect(dateInZone("15:04 MST -0700", REF_DATE, "+05:30")).toBe("15:04 UTC +0000");
    expect(dateInZone("15:04 -0700", REF_DATE, "Etc/GMT+5")).toBe("10:04 -0500");
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

  it("numbers BCE years as Go does: 1 BC is year 0, signed and zero-padded", () => {
    const at = (year: number) => {
      const d = new Date(0);
      d.setUTCFullYear(year, 2, 4);
      return d;
    };
    expect(dateInZone("2006-01-02|06", at(0), "UTC")).toBe("0000-03-04|00");
    expect(dateInZone("2006-01-02|06", at(-5), "UTC")).toBe("-0005-03-04|05");
    expect(dateInZone("2006|06", at(33), "UTC")).toBe("0033|33");
  });

  it("formats offsets at the edges of the Date range, as Go does", () => {
    const layout = "2006-01-02 15:04:05 -0700";
    expect(dateInZone(layout, new Date(-8.64e15), "America/New_York")).toBe(
      "-271821-04-19 19:03:58 -0456",
    );
    expect(dateInZone(layout, new Date(8.64e15), "Pacific/Kiritimati")).toBe(
      "275760-09-13 14:00:00 +1400",
    );
  });
});
