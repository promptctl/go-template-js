import { describe, expect, it } from "vitest";
import { htmlDateInZone } from "./htmlDateInZone.js";

// htmlDate uses local tz so we test via htmlDateInZone which is its basis.
describe("sprig.htmlDateInZone", () => {
  it("formats YYYY-MM-DD in UTC", () => {
    const d = new Date("2024-03-15T12:00:00Z");
    expect(htmlDateInZone(d, "UTC")).toBe("2024-03-15");
  });

  it("adjusts for timezone (date can differ from UTC)", () => {
    // 2024-03-14T23:30:00Z = 2024-03-14 in UTC but 2024-03-15 in UTC+1
    const d = new Date("2024-03-14T23:30:00Z");
    expect(htmlDateInZone(d, "UTC")).toBe("2024-03-14");
    expect(htmlDateInZone(d, "Europe/Paris")).toBe("2024-03-15");
  });

  it("accepts number (unix seconds)", () => {
    // 1136239445 = 2006-01-02T15:04:05Z
    expect(htmlDateInZone(1136239445, "UTC")).toBe("2006-01-02");
  });
});
