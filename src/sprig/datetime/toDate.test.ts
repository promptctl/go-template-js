import { describe, expect, it } from "vitest";
import { dateInZone } from "./dateInZone.js";
import { toDate } from "./toDate.js";

describe("sprig.toDate", () => {
  it("parses RFC3339 UTC", () => {
    const d = toDate("2006-01-02T15:04:05Z07:00", "2006-01-02T15:04:05Z");
    expect(d.getUTCFullYear()).toBe(2006);
    expect(d.getUTCMonth()).toBe(0); // January
    expect(d.getUTCDate()).toBe(2);
    expect(d.getUTCHours()).toBe(15);
    expect(d.getUTCMinutes()).toBe(4);
    expect(d.getUTCSeconds()).toBe(5);
  });

  it("parses date only", () => {
    const d = toDate("2006-01-02", "2024-03-15");
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2); // March
    expect(d.getUTCDate()).toBe(15);
  });

  it("parses with offset (adjusts to UTC)", () => {
    // 10:04:05 -05:00 = 15:04:05 UTC
    const d = toDate("2006-01-02T15:04:05-07:00", "2006-01-02T10:04:05-05:00");
    expect(d.getUTCHours()).toBe(15);
    expect(d.getUTCMinutes()).toBe(4);
  });

  it("round-trips with dateInZone", () => {
    const d = toDate("2006-01-02", "2024-06-01");
    expect(dateInZone("2006-01-02", d, "UTC")).toBe("2024-06-01");
  });

  it("parses month name (long)", () => {
    const d = toDate("January 2, 2006", "March 15, 2024");
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
  });

  it("parses 2-digit year (>=70 → 19xx)", () => {
    const d = toDate("01/02/06", "01/15/75");
    expect(d.getUTCFullYear()).toBe(1975);
  });

  it("parses 2-digit year (<70 → 20xx)", () => {
    const d = toDate("01/02/06", "06/20/24");
    expect(d.getUTCFullYear()).toBe(2024);
  });
});
