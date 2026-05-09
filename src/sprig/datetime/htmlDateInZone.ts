import { resolveDate } from "./_resolve.js";
import { getZoneParts } from "./_zone.js";

/** `htmlDateInZone t zone` — YYYY-MM-DD in the named timezone. */
export function htmlDateInZone(t: unknown, zone: string): string {
  const z = getZoneParts(resolveDate(t), zone);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}
