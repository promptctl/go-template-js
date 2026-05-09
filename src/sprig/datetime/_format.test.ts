import { describe, expect, it } from "vitest";
import { formatGoLayout } from "./_format.js";
import type { ZoneParts } from "./_zone.js";

// Go's own reference time: Mon Jan 2 15:04:05 MST 2006
const REF: ZoneParts = {
  year: 2006,
  month: 1,
  day: 2,
  weekday: 1, // Monday
  hour: 15,
  hour12: 3,
  minute: 4,
  second: 5,
  ms: 0,
  tzAbbr: "MST",
  offsetMinutes: -420, // MST = UTC-7
};

const UTC_REF: ZoneParts = {
  ...REF,
  tzAbbr: "UTC",
  offsetMinutes: 0,
};

describe("formatGoLayout", () => {
  it("RFC3339 (UTC)", () =>
    expect(formatGoLayout("2006-01-02T15:04:05Z07:00", UTC_REF)).toBe("2006-01-02T15:04:05Z"));

  it("RFC3339 with negative offset", () =>
    expect(formatGoLayout("2006-01-02T15:04:05Z07:00", REF)).toBe("2006-01-02T15:04:05-07:00"));

  it("ANSIC", () =>
    expect(formatGoLayout("Mon Jan _2 15:04:05 2006", REF)).toBe("Mon Jan  2 15:04:05 2006"));

  it("UnixDate", () =>
    expect(formatGoLayout("Mon Jan _2 15:04:05 MST 2006", REF)).toBe(
      "Mon Jan  2 15:04:05 MST 2006",
    ));

  it("htmlDate format", () => expect(formatGoLayout("2006-01-02", REF)).toBe("2006-01-02"));

  it("2-digit year", () => expect(formatGoLayout("06", REF)).toBe("06"));

  it("full month name", () => expect(formatGoLayout("January 2006", REF)).toBe("January 2006"));

  it("short month name", () => expect(formatGoLayout("Jan 2006", REF)).toBe("Jan 2006"));

  it("full weekday", () => expect(formatGoLayout("Monday", REF)).toBe("Monday"));

  it("Kitchen (12h)", () => expect(formatGoLayout("3:04PM", REF)).toBe("3:04PM"));

  it("AM hour", () => {
    const am: ZoneParts = { ...REF, hour: 9, hour12: 9 };
    expect(formatGoLayout("3:04PM", am)).toBe("9:04AM");
  });

  it("zero-padded 12h", () => {
    const t: ZoneParts = { ...REF, hour: 3, hour12: 3 };
    expect(formatGoLayout("03:04PM", t)).toBe("03:04AM");
  });

  it("midnight 12h", () => {
    const t: ZoneParts = { ...REF, hour: 0, hour12: 12 };
    expect(formatGoLayout("3:04pm", t)).toBe("12:04am");
  });

  it("offset ±hhmm form", () => expect(formatGoLayout("-0700", REF)).toBe("-0700"));

  it("offset ±hh:mm form", () => expect(formatGoLayout("-07:00", REF)).toBe("-07:00"));

  it("offset Z form (UTC)", () => expect(formatGoLayout("Z0700", UTC_REF)).toBe("Z"));

  it("offset Z form (non-UTC)", () => expect(formatGoLayout("Z0700", REF)).toBe("-0700"));

  it("space-padded single-digit day", () => {
    const t: ZoneParts = { ...REF, day: 2 };
    expect(formatGoLayout("_2", t)).toBe(" 2");
  });

  it("space-padded double-digit day", () => {
    const t: ZoneParts = { ...REF, day: 15 };
    expect(formatGoLayout("_2", t)).toBe("15");
  });

  it("milliseconds .000", () => {
    const t: ZoneParts = { ...REF, ms: 123 };
    expect(formatGoLayout("15:04:05.000", t)).toBe("15:04:05.123");
  });

  it("trailing-zero trim .999", () => {
    const t: ZoneParts = { ...REF, ms: 100 };
    expect(formatGoLayout("15:04:05.999", t)).toBe("15:04:05.1");
  });

  it("zero ms .999 → omits dot", () => {
    expect(formatGoLayout("15:04:05.999", REF)).toBe("15:04:05");
  });

  it("literal characters pass through", () =>
    expect(formatGoLayout("Hello, 2006!", REF)).toBe("Hello, 2006!"));

  it("December correctly not January", () => {
    const t: ZoneParts = { ...REF, month: 12 };
    expect(formatGoLayout("January", t)).toBe("December");
  });
});
