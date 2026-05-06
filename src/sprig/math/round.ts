/** `round a [precision=0]` — round half-away-from-zero, matching Go sprig. */
export function round(a: unknown, precision: unknown = 0): number {
  const n = Number(a);
  const p = Math.trunc(Number(precision));
  const factor = 10 ** p;
  return (Math.sign(n) * Math.round(Math.abs(n) * factor)) / factor;
}
