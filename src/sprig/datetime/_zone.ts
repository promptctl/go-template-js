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
  year: number; // astronomical: 1 BC is 0
  month: number; // 1–12
  day: number; // 1–31
  weekday: number; // 0 = Sun, 1 = Mon, …, 6 = Sat
  hour: number; // 0–23
  hour12: number; // 1–12 (Go's `3` token)
  minute: number;
  second: number;
  ms: number; // milliseconds 0–999 (from UTC epoch)
  tzAbbr: string; // "UTC", "EST", "EDT", etc.
  offsetSeconds: number; // UTC offset, exact (e.g. -18000 for EST, -17762 for New York LMT)
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

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// INTL_OPTS requests every part read here, so a missing one is a runtime
// that broke the contract, not a value to default past.
function readParts(fmt: Intl.DateTimeFormat, date: Date) {
  const parts = new Map<string, string>();
  for (const p of fmt.formatToParts(date)) parts.set(p.type, p.value);
  return (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.get(type);
    if (value === undefined) throw new Error(`Intl.DateTimeFormat omitted the ${type} part`);
    return value;
  };
}

function buildFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", { ...INTL_OPTS, timeZone });
}

// Go's time.LoadLocation rejects UTC offset names ("+05:30"), which Intl
// accepts as zones.
const OFFSET_ZONE = /^[+-]/;

// [LAW:no-shared-mutable-globals] Owned by `zoneFormatter` alone, the only
// reader and writer. Invariant: each entry is a pure function of the key
// (locale and options are fixed), so memoising leaves every result unchanged
// and nothing is ever evicted. Only zones that load are stored, keyed
// ASCII-case-insensitively as ECMA-402 matches them, so the map is bounded by
// the IANA identifiers however a template spells them. Construction costs
// tens of µs; formatting with a warm formatter, a few.
const formattersByZone = new Map<string, Intl.DateTimeFormat>();

// Mirror Go sprig: a zone that does not load falls back to UTC. Intl rejects
// an unknown zone with a RangeError. The UTC formatter is built outside the
// `try`, so a runtime that cannot honour INTL_OPTS at all fails loudly.
function zoneFormatter(name: string): Intl.DateTimeFormat {
  const key = name.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const cached = formattersByZone.get(key);
  if (cached !== undefined) return cached;
  const loaded = OFFSET_ZONE.test(name) ? undefined : buildOrUnknown(name);
  if (loaded === undefined) return zoneFormatter("UTC");
  formattersByZone.set(key, loaded);
  return loaded;
}

function buildOrUnknown(name: string): Intl.DateTimeFormat | undefined {
  if (name === "UTC") return buildFormatter(name);
  try {
    return buildFormatter(name);
  } catch (e) {
    if (e instanceof RangeError) return undefined;
    throw e;
  }
}

/** Extract date parts in the requested IANA timezone. Falls back to "UTC" on invalid zone, mirroring Go sprig. */
export function getZoneParts(date: Date, zone: string): ZoneParts {
  const part = readParts(zoneFormatter(zone), date);

  const eraYear = parseInt(part("year"), 10);
  const year = part("era") === "BC" ? 1 - eraYear : eraYear;
  const month = parseInt(part("month"), 10);
  const day = parseInt(part("day"), 10);
  // hour12: false returns "24" for midnight in some runtimes — normalise.
  const hour = parseInt(part("hour"), 10) % 24;
  const minute = parseInt(part("minute"), 10);
  const second = parseInt(part("second"), 10);
  const ms = date.getUTCMilliseconds();

  // The UTC offset is the wall clock read as if it were UTC, minus the
  // instant: exact to the second, so local mean time offsets such as New
  // York's -4:56:02 before 1883 survive. Plain arithmetic, not a Date,
  // because the wall clock may lie past Date's ±8.64e15 ms range.
  const wallMs =
    daysFromCivil(year, month, day) * 86_400_000 + ((hour * 60 + minute) * 60 + second) * 1000 + ms;
  const offsetSeconds = (wallMs - date.getTime()) / 1000;

  const weekdayName = part("weekday");
  const weekday = WEEKDAY_NAMES.indexOf(weekdayName);
  if (weekday === -1) throw new Error(`Intl.DateTimeFormat gave an unknown weekday ${weekdayName}`);

  return {
    year,
    month,
    day,
    weekday,
    hour,
    hour12: hour % 12 || 12,
    minute,
    second,
    ms,
    tzAbbr: part("timeZoneName"),
    offsetSeconds,
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
// `time.Local` before `main`, but in JS the host zone moves at runtime: Node
// re-resolves it when `process.env.TZ` is assigned, a browser when the OS
// zone changes. The memo is keyed on both signals (the offset stands in for
// the OS zone where there is no `process`), so it resolves afresh, at the
// cost of one formatter, only when one of them moves.
let hostZone: { key: string; zone: string } | undefined;

/** Host timezone name (IANA string). */
export function localTz(): string {
  const key = `${globalThis.process?.env.TZ}|${new Date().getTimezoneOffset()}`;
  if (hostZone?.key !== key) {
    hostZone = { key, zone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }
  return hostZone.zone;
}
