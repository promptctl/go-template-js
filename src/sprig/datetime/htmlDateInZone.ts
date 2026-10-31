import { formatGoLayout } from "./_format.js";
import { resolveDate } from "./_resolve.js";
import { getZoneParts } from "./_zone.js";

/** `htmlDateInZone t zone` — YYYY-MM-DD in the named timezone. */
export function htmlDateInZone(t: unknown, zone: string): string {
  return formatGoLayout("2006-01-02", getZoneParts(resolveDate(t), zone));
}
