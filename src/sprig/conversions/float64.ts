/**
 * `float64 v` — coerce to a JS number. Strings parse via
 * `Number.parseFloat` (Go: `strconv.ParseFloat(s, 64)`); non-numeric
 * input collapses to 0.
 */

// [LAW:dataflow-not-control-flow] Per-kind dispatch lives here once;
// callers don't repeat the shape check.
export function float64(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}
