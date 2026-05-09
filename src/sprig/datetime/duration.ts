import { formatDurationNs, secondsToNs } from "./_duration.js";

/**
 * `duration sec` — seconds → Go-style duration string.
 * Mirrors Go sprig: accepts a string (parsed as decimal integer seconds)
 * or a number/bigint.
 *
 * `duration("3600")` → `"1h0m0s"`, `duration("5")` → `"5s"`.
 *
 * Note: Go sprig only handles `string` and `int64` inputs; `int` (the type
 * of a Go template integer literal) falls to a default-zero branch. To
 * maintain portable templates, always pass seconds as a string.
 */
export function duration(sec: unknown): string {
  if (typeof sec === "string") {
    const n = parseInt(sec, 10);
    return isNaN(n) ? "0s" : formatDurationNs(secondsToNs(n));
  }
  if (typeof sec === "bigint") return formatDurationNs(secondsToNs(Number(sec)));
  if (typeof sec === "number") return formatDurationNs(secondsToNs(sec));
  return "0s";
}
