/**
 * Go reference-time layout tokenizer and formatter.
 *
 * Go's reference time: `Mon Jan 2 15:04:05 MST 2006`
 * Each component uses a unique value so the tokenizer can identify it
 * positionally without ambiguity markers.
 *
 * Strategy: greedy left-to-right scan — try each known token at the
 * current position (longest first); pass literal characters through.
 * Round-trips Go's exact output for every tested layout.
 *
 * [LAW:one-source-of-truth] Format-token definitions live here only;
 * the parser in `_parse.ts` imports the same token list inverted.
 */

import type { ZoneParts } from "./_zone.js";

// ---------------------------------------------------------------------------
// Constant tables
// ---------------------------------------------------------------------------

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

function spacePad2(n: number): string {
  return n < 10 ? ` ${n}` : String(n);
}

// Go prints an offset in whole minutes truncated toward zero, signed by
// those minutes (so -30s prints "+0000"), and writes "Z" only when the exact
// offset in seconds is zero.
function offsetParts(offsetSeconds: number): { sign: string; hh: string; mm: string } {
  const minutes = Math.trunc(offsetSeconds / 60);
  const abs = Math.abs(minutes);
  return {
    sign: minutes < 0 ? "-" : "+",
    hh: pad2(Math.floor(abs / 60)),
    mm: pad2(abs % 60),
  };
}

/** ±hhmm (no colon). E.g. "+0500", "-0500", "+0000". */
function fmtOffset(offsetSeconds: number): string {
  const { sign, hh, mm } = offsetParts(offsetSeconds);
  return `${sign}${hh}${mm}`;
}

/** ±hh:mm (with colon). E.g. "+05:00", "-05:00", "+00:00". */
function fmtOffsetColon(offsetSeconds: number): string {
  const { sign, hh, mm } = offsetParts(offsetSeconds);
  return `${sign}${hh}:${mm}`;
}

/** ±hh only. */
function fmtOffsetHour(offsetSeconds: number): string {
  const { sign, hh } = offsetParts(offsetSeconds);
  return `${sign}${hh}`;
}

/** Z or ±hhmm. */
function fmtOffsetZ(offsetSeconds: number): string {
  return offsetSeconds === 0 ? "Z" : fmtOffset(offsetSeconds);
}

/** Z or ±hh:mm. */
function fmtOffsetColonZ(offsetSeconds: number): string {
  return offsetSeconds === 0 ? "Z" : fmtOffsetColon(offsetSeconds);
}

/** Z or ±hh. */
function fmtOffsetHourZ(offsetSeconds: number): string {
  return offsetSeconds === 0 ? "Z" : fmtOffsetHour(offsetSeconds);
}

// Fractional second helper: pad/trim to `width` digits.
function fmtFrac(ms: number, width: number, trimTrailing: boolean): string {
  // ms is 0–999; expand to full nanosecond-width by multiplying
  const nanosTotal = ms * 1_000_000; // ms → ns
  const full = String(nanosTotal).padStart(9, "0");
  const s = full.slice(0, width);
  if (trimTrailing) return s.replace(/0+$/, "");
  return s;
}

// ---------------------------------------------------------------------------
// Token table — ordered longest-first so greedy matching is correct.
// ---------------------------------------------------------------------------

type Replacer = (z: ZoneParts) => string;

// Each entry: [tokenString, replacer].
// Order MUST be stable and longest-first within the same starting character.
const TOKENS: [string, Replacer][] = [
  // 9-digit fractional seconds
  [".000000000", (z) => `.${fmtFrac(z.ms, 9, false)}`],
  [
    ".999999999",
    (z) => {
      const s = fmtFrac(z.ms, 9, true);
      return s ? `.${s}` : "";
    },
  ],
  // 6-digit fractional seconds
  [".000000", (z) => `.${fmtFrac(z.ms, 6, false)}`],
  [
    ".999999",
    (z) => {
      const s = fmtFrac(z.ms, 6, true);
      return s ? `.${s}` : "";
    },
  ],
  // 3-digit fractional seconds
  [".000", (z) => `.${pad3(z.ms)}`],
  [
    ".999",
    (z) => {
      const s = pad3(z.ms).replace(/0+$/, "");
      return s ? `.${s}` : "";
    },
  ],
  // 7-char
  ["January", (z) => MONTHS_LONG[z.month - 1] ?? "January"],
  // 6-char
  ["Monday", (z) => WEEKDAYS_LONG[z.weekday] ?? "Monday"],
  ["Z07:00", (z) => fmtOffsetColonZ(z.offsetSeconds)],
  ["-07:00", (z) => fmtOffsetColon(z.offsetSeconds)],
  // 5-char
  ["Z0700", (z) => fmtOffsetZ(z.offsetSeconds)],
  ["-0700", (z) => fmtOffset(z.offsetSeconds)],
  // 4-char
  // Go: sign, then the magnitude padded to four digits (-5 → "-0005").
  ["2006", (z) => `${z.year < 0 ? "-" : ""}${String(Math.abs(z.year)).padStart(4, "0")}`],
  // 3-char
  ["Jan", (z) => MONTHS_SHORT[z.month - 1] ?? "Jan"],
  ["Mon", (z) => WEEKDAYS_SHORT[z.weekday] ?? "Mon"],
  ["MST", (z) => z.tzAbbr],
  ["-07", (z) => fmtOffsetHour(z.offsetSeconds)],
  ["Z07", (z) => fmtOffsetHourZ(z.offsetSeconds)],
  // 2-char
  ["15", (z) => pad2(z.hour)],
  ["01", (z) => pad2(z.month)],
  ["02", (z) => pad2(z.day)],
  // Space-padded day: `_2` is underscore+2 in the format string.
  ["_2", (z) => spacePad2(z.day)],
  ["03", (z) => pad2(z.hour12)],
  ["04", (z) => pad2(z.minute)],
  ["05", (z) => pad2(z.second)],
  ["06", (z) => pad2(Math.abs(z.year) % 100)],
  ["PM", (z) => (z.hour >= 12 ? "PM" : "AM")],
  ["pm", (z) => (z.hour >= 12 ? "pm" : "am")],
  // 1-char
  ["1", (z) => String(z.month)],
  ["2", (z) => String(z.day)],
  ["3", (z) => String(z.hour12)],
  ["4", (z) => String(z.minute)],
  ["5", (z) => String(z.second)],
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format `zoneParts` according to Go's reference-time layout string.
 * Literal characters pass through unchanged.
 */
export function formatGoLayout(layout: string, z: ZoneParts): string {
  let result = "";
  let i = 0;
  while (i < layout.length) {
    let matched = false;
    for (const [token, replacer] of TOKENS) {
      if (layout.startsWith(token, i)) {
        result += replacer(z);
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += layout[i++];
    }
  }
  return result;
}
