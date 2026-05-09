/**
 * Sprig date/time functions — `now`, `date`, `dateInZone`, `dateModify`,
 * `htmlDate`, `htmlDateInZone`, `duration`, `durationRound`, `toDate`,
 * `ago`, `unixEpoch`.
 *
 * All "current time" reads go through the `clock` seam so tests can
 * freeze time deterministically. [LAW:single-enforcer]
 *
 * Go format-string support: the full reference-time token set including
 * fractional seconds, all timezone forms, and both 12h and 24h clocks.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import type { Clock } from "./_clock.js";
import { ago } from "./ago.js";
import { date } from "./date.js";
import { dateInZone } from "./dateInZone.js";
import { dateModify } from "./dateModify.js";
import { duration } from "./duration.js";
import { durationRound } from "./durationRound.js";
import { htmlDate } from "./htmlDate.js";
import { htmlDateInZone } from "./htmlDateInZone.js";
import { now } from "./now.js";
import { toDate } from "./toDate.js";
import { unixEpoch } from "./unixEpoch.js";

export {
  ago,
  date,
  dateInZone,
  dateModify,
  duration,
  durationRound,
  htmlDate,
  htmlDateInZone,
  now,
  toDate,
  unixEpoch,
};

/**
 * Build the sprig date/time FuncMap.
 *
 * @param clock - Source of "current time". Defaults to `() => new Date()`.
 *   Pass a frozen clock for deterministic test output (mirrors
 *   `EngineConfig.clock`).
 */
export function sprigDatetime(clock: Clock = () => new Date()): FuncMap {
  return {
    now: {
      fn: () => now(clock),
      argTypes: [],
    },
    date: {
      fn: (format, t) => date(format as string, t),
      argTypes: ["string", "value"],
    },
    dateInZone: {
      fn: (format, t, zone) => dateInZone(format as string, t, zone as string),
      argTypes: ["string", "value", "string"],
    },
    dateModify: {
      fn: (dur, t) => dateModify(dur as string, t),
      argTypes: ["string", "value"],
    },
    htmlDate: {
      fn: (t) => htmlDate(t),
      argTypes: ["value"],
    },
    htmlDateInZone: {
      fn: (t, zone) => htmlDateInZone(t, zone as string),
      argTypes: ["value", "string"],
    },
    duration: {
      fn: (sec) => duration(sec),
      argTypes: ["value"],
    },
    durationRound: {
      fn: (d) => durationRound(d),
      argTypes: ["value"],
    },
    toDate: {
      fn: (format, s) => toDate(format as string, s as string),
      argTypes: ["string", "string"],
    },
    ago: {
      fn: (t) => ago(t, clock),
      argTypes: ["value"],
    },
    unixEpoch: {
      fn: (t) => unixEpoch(t),
      argTypes: ["value"],
    },
  };
}
