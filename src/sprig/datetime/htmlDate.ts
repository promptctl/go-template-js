import { formatGoLayout } from "./_format.js";
import { resolveDate } from "./_resolve.js";
import { getZoneParts, localTz } from "./_zone.js";

/** `htmlDate t` — YYYY-MM-DD in the host timezone. */
export function htmlDate(t: unknown): string {
  return formatGoLayout("2006-01-02", getZoneParts(resolveDate(t), localTz()));
}
