/**
 * `minf a b c …` — variadic float-typed minimum. Float counterpart of
 * `min` (which Go sprig truncates to int64).
 */
export function minf(...args: (number | bigint)[]): number {
  return args.map((v) => Number(v)).reduce((m, v) => (v < m ? v : m), Number.POSITIVE_INFINITY);
}
