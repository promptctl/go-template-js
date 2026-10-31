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
  zone: string; // Intl's canonical name for the zone; "UTC" for the fallback entry
  parts: Intl.DateTimeFormat;
}

function buildZoneFormatter(timeZone: string): ZoneFormatter {
  const parts = new Intl.DateTimeFormat("en-US", { ...INTL_OPTS, timeZone });
  return { zone: parts.resolvedOptions().timeZone, parts };
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
  // tokens print minutes truncated toward zero. Plain arithmetic, not a
  // Date, because the wall clock may lie past Date's ±8.64e15 ms range.
  const wallMs =
    daysFromCivil(year, month, day) * 86_400_000 + ((hour * 60 + minute) * 60 + second) * 1000 + ms;
  const offsetMinutes = Math.trunc((wallMs - date.getTime()) / 60_000);

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

// Days from 1970-01-01 to a proleptic Gregorian date, for any integer year.
// Howard Hinnant's days_from_civil: count in 400-year eras from 0000-03-01.
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

// [LAW:no-shared-mutable-globals] Owned by `localTz` alone. Go fixes
// `time.Local` before `main`, but JS may assign `process.env.TZ` after imports
// run, and Node re-resolves the host zone when it does — so the memo is keyed
// on that value, and resolving costs one formatter only when it changes.
let hostZone: { tzEnv: string | undefined; zone: string } | undefined;

/** Host timezone name (IANA string). */
export function localTz(): string {
  const tzEnv = globalThis.process?.env.TZ;
  if (hostZone === undefined || hostZone.tzEnv !== tzEnv) {
    hostZone = { tzEnv, zone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }
  return hostZone.zone;
}
