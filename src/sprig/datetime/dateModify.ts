import { parseDurationNs } from "./_duration.js";
import { resolveDate } from "./_resolve.js";

/**
 * `dateModify duration t` — add or subtract a Go duration from `t`.
 * `duration` is a Go duration string: "1h30m", "-24h", "300ms".
 */
export function dateModify(duration: string, t: unknown): Date {
  const d = resolveDate(t);
  const ns = parseDurationNs(duration);
  // Mirror Go sprig: return the original date unchanged on parse error.
  if (isNaN(ns)) return d;
  return new Date(d.getTime() + ns / 1_000_000);
}
