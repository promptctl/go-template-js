import { parseDurationNs } from "./_duration.js";
import { resolveDate } from "./_resolve.js";

/**
 * `dateModify duration t` — add or subtract a Go duration from `t`.
 * `duration` is a Go duration string: "1h30m", "-24h", "300ms".
 */
export function dateModify(duration: string, t: unknown): Date {
  const d = resolveDate(t);
  const ns = parseDurationNs(duration);
  if (isNaN(ns)) throw new Error(`sprig dateModify: invalid duration ${JSON.stringify(duration)}`);
  return new Date(d.getTime() + ns / 1_000_000);
}
