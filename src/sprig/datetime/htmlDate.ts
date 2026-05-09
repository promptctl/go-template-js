import { resolveDate } from "./_resolve.js";
import { getZoneParts, localTz } from "./_zone.js";

/** `htmlDate t` — YYYY-MM-DD in the host timezone. */
export function htmlDate(t: unknown): string {
  const z = getZoneParts(resolveDate(t), localTz());
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}
