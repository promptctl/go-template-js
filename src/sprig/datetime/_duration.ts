/**
 * Go-style duration: parsing and formatting.
 *
 * Go's `time.ParseDuration` grammar:
 *   duration  = [-] component+
 *   component = decimal unit
 *   unit      = ns | us | µs | ms | s | m | h
 *
 * Values are nanoseconds internally (same as Go's time.Duration).
 *
 * [LAW:one-source-of-truth] All duration string ↔ nanoseconds
 * conversions live here. No other file does this math.
 */

const NS_PER = {
  h: 3_600_000_000_000,
  m: 60_000_000_000,
  s: 1_000_000_000,
  ms: 1_000_000,
  us: 1_000,
  µs: 1_000,
  ns: 1,
} as const;

type Unit = keyof typeof NS_PER;

/**
 * Parse a Go duration string to nanoseconds (as a float for sub-ms
 * precision). Returns `NaN` on parse failure.
 *
 * Accepts: "0", "300ms", "1.5h", "2h45m", "-1h30m", "100µs".
 */
export function parseDurationNs(s: string): number {
  if (s === "0") return 0;

  let negative = false;
  let rest = s;
  if (rest.startsWith("-")) {
    negative = true;
    rest = rest.slice(1);
  } else if (rest.startsWith("+")) {
    rest = rest.slice(1);
  }

  if (!rest) return NaN;

  let total = 0;
  // Match: decimal (possibly with `.`) followed by unit name.
  // Units sorted longest-first to avoid "m" matching before "ms".
  const UNIT_RE = /^(\d+(?:\.\d+)?)(ns|µs|us|ms|[smh])/;
  while (rest.length > 0) {
    const m = UNIT_RE.exec(rest);
    if (!m) return NaN;
    const value = parseFloat(m[1] ?? "0");
    const unit = m[2] as Unit;
    total += value * NS_PER[unit];
    rest = rest.slice(m[0].length);
  }

  return negative ? -total : total;
}

/**
 * Format nanoseconds as Go's `time.Duration.String()`.
 *
 * Go's algorithm mirrors time/time.go Duration.String():
 * - Values < 1µs:  "Xns"
 * - Values < 1ms:  "X.YYYµs"  (trailing zeros trimmed)
 * - Values < 1s:   "X.YYYms"  (trailing zeros trimmed)
 * - Values >= 1s:  "XhYmZ.WWWs" (hours/minutes shown when non-zero;
 *                  intermediate zero units always shown once hours or
 *                  minutes appear; e.g. "1h0m0s", "1m0s")
 */
export function formatDurationNs(ns: number): string {
  if (ns === 0) return "0s";

  let negative = false;
  let abs = ns;
  if (abs < 0) {
    negative = true;
    abs = -abs;
  }

  let out: string;
  if (abs < NS_PER.us) {
    out = `${Math.floor(abs)}ns`;
  } else if (abs < NS_PER.ms) {
    out = fmtSubUnit(abs, NS_PER.us, 3, "µs");
  } else if (abs < NS_PER.s) {
    out = fmtSubUnit(abs, NS_PER.ms, 6, "ms");
  } else {
    out = fmtGeqSecond(abs);
  }

  return negative ? `-${out}` : out;
}

/** Format sub-second values in a given unit (µs, ms). */
function fmtSubUnit(abs: number, unit: number, fracDigits: number, suffix: string): string {
  const whole = Math.floor(abs / unit);
  const frac = Math.round(abs % unit);
  if (frac === 0) return `${whole}${suffix}`;
  const fracStr = String(frac).padStart(fracDigits, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}${suffix}`;
}

/** Format durations >= 1 second as Go does. */
function fmtGeqSecond(abs: number): string {
  const h = Math.floor(abs / NS_PER.h);
  abs -= h * NS_PER.h;
  const m = Math.floor(abs / NS_PER.m);
  abs -= m * NS_PER.m;
  // abs is now nanoseconds in the current second slot (0..59_999_999_999)
  const s = Math.floor(abs / NS_PER.s);
  const nsFrac = abs - s * NS_PER.s;

  // Format seconds, optionally with nanosecond fraction.
  const secStr =
    nsFrac === 0
      ? `${s}s`
      : `${s}.${String(Math.round(nsFrac)).padStart(9, "0").replace(/0+$/, "")}s`;

  if (h > 0) return `${h}h${m}m${secStr}`;
  if (m > 0) return `${m}m${secStr}`;
  return secStr;
}

/** Format nanoseconds as a duration, rounding to the largest non-zero unit. */
export function roundDurationNs(ns: number): string {
  const abs = Math.abs(ns);

  // Round to the appropriate precision level.
  let rounded: number;
  if (abs >= NS_PER.h) {
    rounded = Math.round(ns / NS_PER.h) * NS_PER.h;
  } else if (abs >= NS_PER.m) {
    rounded = Math.round(ns / NS_PER.m) * NS_PER.m;
  } else if (abs >= NS_PER.s) {
    rounded = Math.round(ns / NS_PER.s) * NS_PER.s;
  } else if (abs >= NS_PER.ms) {
    rounded = Math.round(ns / NS_PER.ms) * NS_PER.ms;
  } else if (abs >= NS_PER.us) {
    rounded = Math.round(ns / NS_PER.us) * NS_PER.us;
  } else {
    rounded = ns;
  }

  return formatDurationNs(rounded);
}

/** Convert integer seconds to nanoseconds. */
export function secondsToNs(s: number): number {
  return s * NS_PER.s;
}
