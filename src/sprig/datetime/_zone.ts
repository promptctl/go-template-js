/**
 * Timezone-aware date parts extraction via Intl.DateTimeFormat.
 *
 * No third-party deps. All modern runtimes (Node ≥ 14, Bun, Deno,
 * browsers) ship Intl with IANA tz database support.
 *
 * [LAW:single-enforcer] All timezone arithmetic routes through
 * `getZoneParts` — never through `date.getHours()` (host-tz) or manual
 * offset computation at callsites.
 */

export interface ZoneParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  weekday: number; // 0 = Sun, 1 = Mon, …, 6 = Sat
  hour: number; // 0–23
  hour12: number; // 1–12 (Go's `3` token)
  minute: number;
  second: number;
  ms: number; // milliseconds 0–999 (from UTC epoch)
  tzAbbr: string; // "UTC", "EST", "EDT", etc.
  offsetMinutes: number; // UTC offset in minutes (e.g. -300 for EST)
}

const INTL_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

// Index parts array by type for O(1) access.
function indexParts(parts: Intl.DateTimeFormatPart[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of parts) out.set(p.type, p.value);
  return out;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Extract date parts in the requested IANA timezone. Falls back to "UTC" on invalid zone, mirroring Go sprig. */
export function getZoneParts(date: Date, tzInput: string): ZoneParts {
  // Mirror Go sprig: unknown tz → fall back to UTC.
  let tz: string;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzInput });
    tz = tzInput;
  } catch {
    tz = "UTC";
  }
  const fmt = new Intl.DateTimeFormat("en-US", { ...INTL_OPTS, timeZone: tz });
  const p = indexParts(fmt.formatToParts(date));

  // hour12: false returns "24" for midnight in some runtimes — normalise.
  const hour = parseInt(p.get("hour") ?? "0", 10) % 24;

  // Get timezone abbreviation via separate formatter (avoids mixing options).
  const abbrFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  });
  const abbrParts = indexParts(abbrFmt.formatToParts(date));
  const tzAbbr = abbrParts.get("timeZoneName") ?? tz;

  // UTC offset in minutes from "GMT±h:mm" or "GMT" produced by shortOffset.
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const offsetParts = indexParts(offsetFmt.formatToParts(date));
  const offsetMinutes = parseGMTOffset(offsetParts.get("timeZoneName") ?? "GMT");

  const weekday = WEEKDAY_NAMES.indexOf(p.get("weekday") ?? "Sunday");

  return {
    year: parseInt(p.get("year") ?? "2000", 10),
    month: parseInt(p.get("month") ?? "1", 10),
    day: parseInt(p.get("day") ?? "1", 10),
    weekday: weekday === -1 ? 0 : weekday,
    hour,
    hour12: hour % 12 || 12,
    minute: parseInt(p.get("minute") ?? "0", 10),
    second: parseInt(p.get("second") ?? "0", 10),
    ms: date.getUTCMilliseconds(),
    tzAbbr,
    offsetMinutes,
  };
}

/** Parse "GMT", "GMT+5", "GMT+5:30", "GMT-4" → offset in minutes. */
function parseGMTOffset(s: string): number {
  if (s === "GMT" || s === "UTC") return 0;
  const m = s.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  const h = parseInt(m[2]!, 10);
  const min = parseInt(m[3] ?? "0", 10);
  return sign * (h * 60 + min);
}

/** Host timezone name (IANA string). */
export function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
