import { formatGoLayout } from "./_format.js";
import { resolveDate } from "./_resolve.js";
import { getZoneParts } from "./_zone.js";

/**
 * `dateInZone format t zone` — format `t` using Go's reference-time
 * layout, displayed in the named IANA timezone.
 */
export function dateInZone(format: string, t: unknown, zone: string): string {
  const d = resolveDate(t);
  return formatGoLayout(format, getZoneParts(d, zone));
}
