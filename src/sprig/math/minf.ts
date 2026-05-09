/**
 * `minf a b c …` — variadic float-typed minimum. Float counterpart of
 * `min` (which Go sprig truncates to int64).
 */
export function minf(...args: (number | bigint)[]): number {
  return Math.min(...args.map((v) => Number(v)));
}
