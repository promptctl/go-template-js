/**
 * Parse a date string according to Go's reference-time layout.
 *
 * Mirrors `time.ParseInLocation` with UTC as the default location
 * (when the layout contains no timezone token, the result is UTC).
 *
 * Strategy: tokenise the layout the same way the formatter does —
 * greedy longest-match — but instead of replacing tokens with values,
 * consume the corresponding characters from the value string.
 */

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

// ---------------------------------------------------------------------------
// Parse state
// ---------------------------------------------------------------------------

interface ParseState {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number; // 0–23
  minute: number;
  second: number;
  ms: number;
  offsetMinutes: number; // UTC offset; NaN means "not set" → default to UTC
  isPM: boolean;
  hour12: boolean; // did layout use 12h token?
}

function defaultState(): ParseState {
  return {
    year: 2000,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
    offsetMinutes: 0,
    isPM: false,
    hour12: false,
  };
}

// ---------------------------------------------------------------------------
// Value-string consumers
// ---------------------------------------------------------------------------

function consumeFixed(val: string, pos: number, n: number): [string, number] {
  return [val.slice(pos, pos + n), pos + n];
}

function consumeDigits(val: string, pos: number, min: number, max: number): [number, number] {
  let end = pos;
  while (end < val.length && end - pos < max && val[end]! >= "0" && val[end]! <= "9") end++;
  if (end - pos < min) throw new Error(`sprig toDate: expected ${min}-${max} digits at pos ${pos}`);
  return [parseInt(val.slice(pos, end), 10), end];
}

function consumeMonthLong(val: string, pos: number): [number, number] {
  for (let i = 0; i < MONTHS_LONG.length; i++) {
    const m = MONTHS_LONG[i]!;
    if (val.startsWith(m, pos)) return [i + 1, pos + m.length];
  }
  throw new Error(`sprig toDate: expected month name at pos ${pos}`);
}

function consumeMonthShort(val: string, pos: number): [number, number] {
  for (let i = 0; i < MONTHS_SHORT.length; i++) {
    const m = MONTHS_SHORT[i]!;
    if (val.startsWith(m, pos)) return [i + 1, pos + m.length];
  }
  throw new Error(`sprig toDate: expected short month name at pos ${pos}`);
}

function consumeWeekdayLong(val: string, pos: number): number {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const d of days) if (val.startsWith(d, pos)) return pos + d.length;
  throw new Error(`sprig toDate: expected weekday name at pos ${pos}`);
}

function consumeWeekdayShort(val: string, pos: number): number {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of days) if (val.startsWith(d, pos)) return pos + d.length;
  throw new Error(`sprig toDate: expected short weekday name at pos ${pos}`);
}

function consumeSpacePaddedDay(val: string, pos: number): [number, number] {
  // Leading space or digit for space-padded day (`_2` token).
  if (val[pos] === " ") {
    const [n, end] = consumeDigits(val, pos + 1, 1, 1);
    return [n, end];
  }
  return consumeDigits(val, pos, 1, 2);
}

/** Parse offset like "+0500", "-0500", "+05:00", "-05:00", "+05", "-05". Returns minutes. */
function consumeOffset(val: string, pos: number, withColon: boolean): [number, number] {
  const sign = val[pos] === "+" ? 1 : val[pos] === "-" ? -1 : 0;
  if (sign === 0) throw new Error(`sprig toDate: expected +/- at pos ${pos}`);
  let p = pos + 1;
  const [h, p2] = consumeDigits(val, p, 2, 2);
  p = p2;
  let m = 0;
  if (withColon && val[p] === ":") {
    const [m2, p3] = consumeDigits(val, p + 1, 2, 2);
    m = m2;
    p = p3;
  } else if (!withColon) {
    const [m2, p3] = consumeDigits(val, p, 2, 2);
    m = m2;
    p = p3;
  }
  return [sign * (h * 60 + m), p];
}

/** Parse "Z" or an offset. withColon controls +05:00 vs +0500 form. Returns [offsetMinutes, newPos]. */
function consumeZOrOffset(
  val: string,
  pos: number,
  withColon: boolean,
  hourOnly: boolean,
): [number, number] {
  if (val[pos] === "Z") return [0, pos + 1];
  if (hourOnly) {
    const sign = val[pos] === "+" ? 1 : val[pos] === "-" ? -1 : 0;
    if (sign === 0) throw new Error(`sprig toDate: expected Z or +/- at pos ${pos}`);
    const [h, p2] = consumeDigits(val, pos + 1, 2, 2);
    return [sign * h * 60, p2];
  }
  return consumeOffset(val, pos, withColon);
}

/** Parse timezone abbreviation (e.g. "UTC", "EST"). Returns new pos. */
function consumeTzAbbr(val: string, pos: number): number {
  // TZ abbreviation is a run of uppercase letters.
  let end = pos;
  while (end < val.length && val[end]! >= "A" && val[end]! <= "Z") end++;
  if (end === pos) throw new Error(`sprig toDate: expected timezone abbreviation at pos ${pos}`);
  return end;
}

/** Parse fractional seconds (like ".000", ".999", etc.) starting AFTER the dot. */
function consumeFrac(val: string, pos: number, width: number): [number, number] {
  const [raw, end] = consumeFixed(val, pos, width);
  const ns = parseInt(raw.padEnd(9, "0"), 10);
  return [Math.round(ns / 1_000_000), end]; // → ms
}

// ---------------------------------------------------------------------------
// Token dispatch
// ---------------------------------------------------------------------------

// Returns [newValPos, modified state], consuming both layout and value tokens.
function dispatchToken(
  token: string,
  val: string,
  vp: number,
  st: ParseState,
): [number, ParseState] {
  const s = { ...st };
  switch (token) {
    case "January": {
      const [m, p2] = consumeMonthLong(val, vp);
      s.month = m;
      return [p2, s];
    }
    case "Monday": {
      const p2 = consumeWeekdayLong(val, vp);
      return [p2, s];
    }
    case "Jan": {
      const [m, p2] = consumeMonthShort(val, vp);
      s.month = m;
      return [p2, s];
    }
    case "Mon": {
      const p2 = consumeWeekdayShort(val, vp);
      return [p2, s];
    }
    case "2006": {
      const [y, p2] = consumeDigits(val, vp, 4, 4);
      s.year = y;
      return [p2, s];
    }
    case "06": {
      const [y, p2] = consumeDigits(val, vp, 2, 2);
      s.year = y < 70 ? 2000 + y : 1900 + y;
      return [p2, s];
    }
    case "01": {
      const [m, p2] = consumeDigits(val, vp, 2, 2);
      s.month = m;
      return [p2, s];
    }
    case "1": {
      const [m, p2] = consumeDigits(val, vp, 1, 2);
      s.month = m;
      return [p2, s];
    }
    case "_2": {
      const [d, p2] = consumeSpacePaddedDay(val, vp);
      s.day = d;
      return [p2, s];
    }
    case "02": {
      const [d, p2] = consumeDigits(val, vp, 2, 2);
      s.day = d;
      return [p2, s];
    }
    case "2": {
      const [d, p2] = consumeDigits(val, vp, 1, 2);
      s.day = d;
      return [p2, s];
    }
    case "15": {
      const [h, p2] = consumeDigits(val, vp, 2, 2);
      s.hour = h;
      return [p2, s];
    }
    case "03": {
      const [h, p2] = consumeDigits(val, vp, 2, 2);
      s.hour = h;
      s.hour12 = true;
      return [p2, s];
    }
    case "3": {
      const [h, p2] = consumeDigits(val, vp, 1, 2);
      s.hour = h;
      s.hour12 = true;
      return [p2, s];
    }
    case "04": {
      const [m, p2] = consumeDigits(val, vp, 2, 2);
      s.minute = m;
      return [p2, s];
    }
    case "4": {
      const [m, p2] = consumeDigits(val, vp, 1, 2);
      s.minute = m;
      return [p2, s];
    }
    case "05": {
      const [sec, p2] = consumeDigits(val, vp, 2, 2);
      s.second = sec;
      return [p2, s];
    }
    case "5": {
      const [sec, p2] = consumeDigits(val, vp, 1, 2);
      s.second = sec;
      return [p2, s];
    }
    case "PM":
    case "pm": {
<<<<<<< HEAD
      const ampm = val.slice(vp, vp + 2);
      const lower = ampm.toLowerCase();
      if (lower !== "am" && lower !== "pm") {
        throw new Error(
          `sprig toDate: expected "AM" or "PM" at pos ${vp}, got ${JSON.stringify(ampm)}`,
        );
      }
      s.isPM = lower === "pm";
=======
      const ampm = val.slice(vp, vp + 2).toLowerCase();
      s.isPM = ampm === "pm";
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
      s.hour12 = true;
      return [vp + 2, s];
    }
    case "MST": {
      const p2 = consumeTzAbbr(val, vp);
      // We don't map abbreviation → offset (ambiguous); keep current offset.
      return [p2, s];
    }
    case "-0700": {
      const [off, p2] = consumeOffset(val, vp, false);
      s.offsetMinutes = off;
      return [p2, s];
    }
    case "-07:00": {
      const [off, p2] = consumeOffset(val, vp, true);
      s.offsetMinutes = off;
      return [p2, s];
    }
    case "-07": {
      const sign = val[vp] === "+" ? 1 : val[vp] === "-" ? -1 : 0;
      if (sign === 0) throw new Error(`sprig toDate: expected +/- at pos ${vp}`);
      const [h, p2] = consumeDigits(val, vp + 1, 2, 2);
      s.offsetMinutes = sign * h * 60;
      return [p2, s];
    }
    case "Z0700": {
      const [off, p2] = consumeZOrOffset(val, vp, false, false);
      s.offsetMinutes = off;
      return [p2, s];
    }
    case "Z07:00": {
      const [off, p2] = consumeZOrOffset(val, vp, true, false);
      s.offsetMinutes = off;
      return [p2, s];
    }
    case "Z07": {
      const [off, p2] = consumeZOrOffset(val, vp, false, true);
      s.offsetMinutes = off;
      return [p2, s];
    }
    case ".000000000": {
<<<<<<< HEAD
      // consume dot + 9 digits
      const p2 = vp + (val[vp] === "." ? 1 : 0);
      const [ms, p3] = consumeFrac(val, p2, 9);
=======
      // consume dot + 9 digits (dot is required)
      if (val[vp] !== ".") throw new Error(`sprig toDate: expected . at pos ${vp}`);
      const [ms, p3] = consumeFrac(val, vp + 1, 9);
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
      s.ms = ms;
      return [p3, s];
    }
    case ".999999999": {
      // optional: if val has a dot here, consume; otherwise skip
      if (val[vp] !== ".") return [vp, s];
      const end = vp + 1;
      let e2 = end;
      while (e2 < val.length && val[e2]! >= "0" && val[e2]! <= "9") e2++;
      const frac = val.slice(end, e2).padEnd(9, "0");
      s.ms = Math.round(parseInt(frac, 10) / 1_000_000);
      return [e2, s];
    }
    case ".000000": {
<<<<<<< HEAD
      const p2 = vp + (val[vp] === "." ? 1 : 0);
      const [ms, p3] = consumeFrac(val, p2, 6);
=======
      // dot is required
      if (val[vp] !== ".") throw new Error(`sprig toDate: expected . at pos ${vp}`);
      const [ms, p3] = consumeFrac(val, vp + 1, 6);
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
      s.ms = ms;
      return [p3, s];
    }
    case ".999999": {
      if (val[vp] !== ".") return [vp, s];
      const end = vp + 1;
      let e2 = end;
      while (e2 < val.length && val[e2]! >= "0" && val[e2]! <= "9") e2++;
      const frac = val.slice(end, e2).padEnd(9, "0");
      s.ms = Math.round(parseInt(frac, 10) / 1_000_000);
      return [e2, s];
    }
    case ".000": {
<<<<<<< HEAD
      const p2 = vp + (val[vp] === "." ? 1 : 0);
      const [ms, p3] = consumeFrac(val, p2, 3);
=======
      // dot is required
      if (val[vp] !== ".") throw new Error(`sprig toDate: expected . at pos ${vp}`);
      const [ms, p3] = consumeFrac(val, vp + 1, 3);
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
      s.ms = ms;
      return [p3, s];
    }
    case ".999": {
      if (val[vp] !== ".") return [vp, s];
      const end = vp + 1;
      let e2 = end;
      while (e2 < val.length && val[e2]! >= "0" && val[e2]! <= "9") e2++;
      const frac = val.slice(end, e2).padEnd(3, "0");
      s.ms = parseInt(frac, 10);
      return [e2, s];
    }
  }
  throw new Error(`sprig toDate: unhandled token ${token}`);
}

// Token list in the same order as _format.ts (longest first).
const TOKENS: string[] = [
  ".000000000", ".999999999",
  ".000000", ".999999",
  ".000", ".999",
  "January",
  "Monday", "Z07:00", "-07:00",
  "Z0700", "-0700",
  "2006",
  "Jan", "Mon", "MST", "-07", "Z07",
  "15", "01", "02", "_2", "03", "04", "05", "06", "PM", "pm",
  "1", "2", "3", "4", "5",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse `value` according to Go's reference-time `layout`.
 * Returns a UTC-based `Date` whose wall time corresponds to the parsed
 * components adjusted for the parsed timezone offset.
 */
export function parseGoLayout(layout: string, value: string): Date {
  let lp = 0;
  let vp = 0;
  let st = defaultState();

  while (lp < layout.length) {
    let matched = false;
    for (const token of TOKENS) {
      if (layout.startsWith(token, lp)) {
        const [newVp, newSt] = dispatchToken(token, value, vp, st);
        vp = newVp;
        st = newSt;
        lp += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Literal character: must match in value.
      const lc = layout[lp]!;
      if (value[vp] !== lc) {
        throw new Error(
          `sprig toDate: expected ${JSON.stringify(lc)} at pos ${vp}, got ${JSON.stringify(value[vp])}`,
        );
      }
      lp++;
      vp++;
    }
  }

<<<<<<< HEAD
  // Verify the entire value string was consumed.
  if (vp !== value.length) {
    throw new Error(
      `sprig toDate: extra characters at pos ${vp}: ${JSON.stringify(value.slice(vp))}`,
    );
  }

=======
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
  // Adjust 12-hour clock.
  if (st.hour12) {
    const h12 = st.hour % 12;
    st.hour = st.isPM ? h12 + 12 : h12;
  }

  // Build UTC timestamp from components + offset.
  const utcMs =
    Date.UTC(st.year, st.month - 1, st.day, st.hour, st.minute, st.second, st.ms) -
    st.offsetMinutes * 60 * 1000;
  return new Date(utcMs);
}
