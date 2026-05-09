import { describe, expect, it } from "vitest";
import { durationRound } from "./durationRound.js";

// durationRound TRUNCATES to the largest unit using integer division.
// Comparisons are STRICT (>), so exactly 1h → "60m" not "1h".
// Output uses custom single-unit suffixes: y, mo, d, h, m, s.
describe("sprig.durationRound", () => {
  it("1h30m → '1h' (truncate)", () => expect(durationRound("1h30m")).toBe("1h"));
  it("1h29m → '1h' (truncate)", () => expect(durationRound("1h29m")).toBe("1h"));
  it("90s → '1m'", () => expect(durationRound("90s")).toBe("1m"));
  it("30s → '30s'", () => expect(durationRound("30s")).toBe("30s"));
  it("29s → '29s'", () => expect(durationRound("29s")).toBe("29s"));
  // Exactly 1h is NOT > hour (strict), falls to minute level.
  it("1h → '60m' (strict > means 1h falls to minutes)", () =>
    expect(durationRound("1h")).toBe("60m"));
  it("2h → '2h'", () => expect(durationRound("2h")).toBe("2h"));
  it("25h → '1d'", () => expect(durationRound("25h")).toBe("1d"));
  it("0 → '0s'", () => expect(durationRound("0")).toBe("0s"));
  it("invalid input → '0s'", () => expect(durationRound("bad")).toBe("0s"));
});
