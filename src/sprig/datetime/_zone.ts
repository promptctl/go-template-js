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

// `era` lets BCE years be told from CE: Intl numbers 1 BC as year "1".
// `timeZoneName` adds the short abbreviation as a part.
const INTL_OPTS: Intl.DateTimeFormatOptions = {
  era: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
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

interface ZoneFormatter {
  zone: string; // the zone Intl accepted; "UTC" for the fallback entry
  parts: Intl.DateTimeFormat;
}

function buildZoneFormatter(zone: string): ZoneFormatter {
  return { zone, parts: new Intl.DateTimeFormat("en-US", { ...INTL_OPTS, timeZone: zone }) };
}

// Built at load, so a runtime that cannot honour INTL_OPTS fails on import
// rather than being mistaken for an unknown zone on every call.
const UTC_FORMATTER = buildZoneFormatter("UTC");

// [LAW:no-shared-mutable-globals] Owned by `zoneFormatter` alone, the only
// reader and writer. Invariant: each entry is a pure function of the key
// (locale and options are fixed), so memoising leaves every result unchanged
// and nothing is ever evicted. Only zones Intl accepts are stored, keyed
// ASCII-case-insensitively as ECMA-402 matches them, so the map is bounded
// by the IANA names and offset zones however the template spells them.
// Construction costs tens of µs; formatting with a warm formatter, a few.
const formattersByZone = new Map<string, ZoneFormatter>();

// Mirror Go sprig: an unknown zone falls back to UTC. Intl rejects it with a
// RangeError at construction.
function zoneFormatter(tzInput: string): ZoneFormatter {
  const key = tzInput.replace(/[A-Z]/g, (c) => c.toLowerCase());
  let f = formattersByZone.get(key);
  if (f === undefined) {
    try {
      f = buildZoneFormatter(tzInput);
    } catch {
      return UTC_FORMATTER;
    }
    formattersByZone.set(key, f);
  }
  return f;
}

/** Extract date parts in the requested IANA timezone. Falls back to "UTC" on invalid zone, mirroring Go sprig. */
export function getZoneParts(date: Date, tzInput: string): ZoneParts {
  const fmt = zoneFormatter(tzInput);
  const p = indexParts(fmt.parts.formatToParts(date));

  // Astronomical year, as Go counts: 1 BC is year 0.
  const eraYear = parseInt(p.get("year") ?? "2000", 10);
  const year = p.get("era") === "BC" ? 1 - eraYear : eraYear;
  const month = parseInt(p.get("month") ?? "1", 10);
  const day = parseInt(p.get("day") ?? "1", 10);
  // hour12: false returns "24" for midnight in some runtimes — normalise.
  const hour = parseInt(p.get("hour") ?? "0", 10) % 24;
  const minute = parseInt(p.get("minute") ?? "0", 10);
  const second = parseInt(p.get("second") ?? "0", 10);
  const ms = date.getUTCMilliseconds();

  // The UTC offset is the wall clock read as if it were UTC, minus the
  // instant. Exact to the second, so local mean time offsets such as
  // New York's -4:56:02 before 1883 come out as Go has them; Go's offset
  // tokens print minutes truncated toward zero.
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, ms);
  const offsetMinutes = Math.trunc((wall.getTime() - date.getTime()) / 60_000);

  const weekday = WEEKDAY_NAMES.indexOf(p.get("weekday") ?? "Sunday");

  return {
    year,
    month,
    day,
    weekday: weekday === -1 ? 0 : weekday,
    hour,
    hour12: hour % 12 || 12,
    minute,
    second,
    ms,
    tzAbbr: p.get("timeZoneName") ?? fmt.zone,
    offsetMinutes,
  };
}

/** Host timezone name (IANA string). Read per call: Go fixes `time.Local`
 * before `main`, but JS code may set `process.env.TZ` after imports run. */
export function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
