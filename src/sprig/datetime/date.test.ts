import { afterEach, describe, expect, it } from "vitest";
import { date } from "./date.js";

const REF_DATE = new Date("2006-01-02T15:04:05Z");
const hostTz = process.env.TZ;

describe("sprig.date", () => {
  afterEach(() => {
    process.env.TZ = hostTz;
  });

  it("formats in the host zone as TZ stands at the call, not at import", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(date("15:04 -0700", REF_DATE)).toBe("00:04 +0900");
    process.env.TZ = "UTC";
    expect(date("15:04 -0700", REF_DATE)).toBe("15:04 +0000");
  });
});
