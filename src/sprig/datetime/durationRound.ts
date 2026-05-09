import { parseDurationNs } from "./_duration.js";

// Mirror Go sprig's constants (nanoseconds). Comparisons are strict (>).
const YEAR = 3_600_000_000_000 * 24 * 365;
const MONTH = 3_600_000_000_000 * 24 * 30;
const DAY = 3_600_000_000_000 * 24;
const HOUR = 3_600_000_000_000;
const MINUTE = 60_000_000_000;
const SECOND = 1_000_000_000;

/**
 * `durationRound d` — parse a Go duration string and truncate to the
 * largest unit. Mirrors Go sprig's `durationRound` which uses integer
 * division (NOT rounding) and custom single-unit suffixes.
 *
 * Examples: "1h30m" → "1h", "90s" → "1m", "1h" → "60m" (strict >).
 */
export function durationRound(d: unknown): string {
  const s = String(d);
  const ns = parseDurationNs(s);
  if (isNaN(ns)) return "0s";

  const u = Math.abs(ns);
  if (u > YEAR) return `${Math.floor(u / YEAR)}y`;
  if (u > MONTH) return `${Math.floor(u / MONTH)}mo`;
  if (u > DAY) return `${Math.floor(u / DAY)}d`;
  if (u > HOUR) return `${Math.floor(u / HOUR)}h`;
  if (u > MINUTE) return `${Math.floor(u / MINUTE)}m`;
  if (u > SECOND) return `${Math.floor(u / SECOND)}s`;
  return "0s";
}
