import { describe, expect, it } from "vitest";
import { formatDurationNs, parseDurationNs, roundDurationNs, secondsToNs } from "./_duration.js";

describe("_duration.parseDurationNs", () => {
  it("parses 0", () => expect(parseDurationNs("0")).toBe(0));
  it("parses seconds", () => expect(parseDurationNs("5s")).toBe(5_000_000_000));
  it("parses minutes", () => expect(parseDurationNs("1m30s")).toBe(90_000_000_000));
  it("parses hours", () => expect(parseDurationNs("2h")).toBe(7_200_000_000_000));
  it("parses compound", () => expect(parseDurationNs("1h30m45s")).toBe(5_445_000_000_000));
  it("parses negative", () => expect(parseDurationNs("-2h")).toBe(-7_200_000_000_000));
  it("parses milliseconds", () => expect(parseDurationNs("300ms")).toBe(300_000_000));
  it("parses microseconds", () => expect(parseDurationNs("100us")).toBe(100_000));
  it("parses nanoseconds", () => expect(parseDurationNs("50ns")).toBe(50));
  it("parses fractional hours", () => expect(parseDurationNs("1.5h")).toBe(5_400_000_000_000));
  it("returns NaN for bad input", () => expect(parseDurationNs("bad")).toBeNaN());
});

describe("_duration.formatDurationNs", () => {
  it("formats 0 as '0s'", () => expect(formatDurationNs(0)).toBe("0s"));
  it("formats seconds only", () => expect(formatDurationNs(secondsToNs(5))).toBe("5s"));
  it("formats minutes+seconds", () => expect(formatDurationNs(secondsToNs(65))).toBe("1m5s"));
  it("formats minutes with 0 seconds", () =>
    expect(formatDurationNs(secondsToNs(60))).toBe("1m0s"));
  it("formats hours+minutes+seconds", () =>
    expect(formatDurationNs(secondsToNs(3661))).toBe("1h1m1s"));
  it("formats hours with zeros", () => expect(formatDurationNs(secondsToNs(3600))).toBe("1h0m0s"));
  it("formats negative", () => expect(formatDurationNs(secondsToNs(-5))).toBe("-5s"));
  it("formats milliseconds", () => expect(formatDurationNs(300_000_000)).toBe("300ms"));
});

describe("_duration.roundDurationNs", () => {
  it("rounds 1h30m to 2h", () => expect(roundDurationNs(parseDurationNs("1h30m"))).toBe("2h0m0s"));
  it("rounds 1h29m to 1h", () => expect(roundDurationNs(parseDurationNs("1h29m"))).toBe("1h0m0s"));
  it("rounds 90s to 2m", () => expect(roundDurationNs(parseDurationNs("90s"))).toBe("2m0s"));
  // 30s < 1m → rounds at second level → stays 30s
  it("30s stays 30s (rounds at second level)", () =>
    expect(roundDurationNs(parseDurationNs("30s"))).toBe("30s"));
  // 29s < 1m → stays 29s
  it("29s stays 29s", () => expect(roundDurationNs(parseDurationNs("29s"))).toBe("29s"));
});
