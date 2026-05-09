import type { Clock } from "./_clock.js";
import { formatDurationNs } from "./_duration.js";
import { resolveDate } from "./_resolve.js";

/**
 * `ago t` — Go-style duration since `t`.
 * Mirrors Go sprig: `time.Since(t).Round(time.Second).String()`.
 */
export function ago(t: unknown, clock: Clock): string {
  const ms = clock().getTime() - resolveDate(t).getTime();
  // Round to nearest second then format.
  const ns = Math.round(ms / 1000) * 1_000_000_000;
  return formatDurationNs(ns);
}
