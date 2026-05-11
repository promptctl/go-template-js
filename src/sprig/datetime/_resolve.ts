/**
 * Normalise the heterogeneous `t` argument accepted by date functions.
 *
 * Go sprig's `dateInZone` accepts: `time.Time`, `int64`, `int`, `int32`.
 * JS side: `Date`, `number` (Unix seconds), `bigint` (Unix seconds),
 * `string` (ISO / Go-layout string).
 *
 * When `t` is already a `Date`, it is returned unchanged.
 * When `t` is a number or bigint, it is treated as Unix seconds (matching
 * Go's `time.Unix(n, 0)` — NOT milliseconds).
 * When `t` is a string, it is parsed by `Date.parse` as a fallback.
 *
 * [LAW:single-enforcer] One place owns `t → Date` normalisation.
 * All date functions call this; none duplicate the logic.
 */
export function resolveDate(t: unknown): Date {
  if (t instanceof Date) return t;
  if (typeof t === "bigint") return new Date(Number(t) * 1000);
  if (typeof t === "number") return new Date(t * 1000);
  if (typeof t === "string") {
    const parsed = new Date(t);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    throw new Error(`sprig: cannot parse date value ${JSON.stringify(t)}`);
  }
  throw new Error(`sprig: unsupported date type: ${typeof t}`);
}
