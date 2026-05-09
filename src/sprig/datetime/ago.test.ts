import { describe, expect, it } from "vitest";
import { ago } from "./ago.js";

describe("sprig.ago", () => {
  it("5 seconds ago", () => {
    const past = new Date("2006-01-02T15:04:00Z");
    const now = new Date("2006-01-02T15:04:05Z");
    expect(ago(past, () => now)).toBe("5s");
  });

  it("1 minute ago", () => {
    const past = new Date("2006-01-02T15:03:05Z");
    const now = new Date("2006-01-02T15:04:05Z");
    expect(ago(past, () => now)).toBe("1m0s");
  });

  it("1 hour ago", () => {
    const past = new Date("2006-01-02T14:04:05Z");
    const now = new Date("2006-01-02T15:04:05Z");
    expect(ago(past, () => now)).toBe("1h0m0s");
  });

  it("rounds to nearest second", () => {
    const past = new Date("2006-01-02T15:04:04Z"); // 1s 499ms ago
    const now = new Date(past.getTime() + 1499);
    expect(ago(past, () => now)).toBe("1s");
  });
});
