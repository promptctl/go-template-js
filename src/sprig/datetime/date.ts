import { formatGoLayout } from "./_format.js";
import { resolveDate } from "./_resolve.js";
import { getZoneParts, localTz } from "./_zone.js";

/**
 * `date format t` — format `t` using Go's reference-time layout,
 * in the host timezone (mirrors Go's `date` which uses `time.Local`).
 */
export function date(format: string, t: unknown): string {
  const d = resolveDate(t);
  return formatGoLayout(format, getZoneParts(d, localTz()));
}
