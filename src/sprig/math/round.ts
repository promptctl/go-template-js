/** `round a [precision=0]` — round half-away-from-zero, matching Go sprig. */
export function round(a: number, precision: number = 0): number {
  const factor = 10 ** precision;
  return (Math.sign(a) * Math.round(Math.abs(a) * factor)) / factor;
}
