/**
 * `minf a b c …` — variadic float-typed minimum. Float counterpart of
 * `min` (which Go sprig truncates to int64).
 */
export function minf(...args: (number | bigint)[]): number {
<<<<<<< HEAD
  return args.map((v) => Number(v)).reduce((m, v) => (v < m ? v : m), Number.POSITIVE_INFINITY);
=======
  return args.map((v) => Number(v)).reduce((m, v) => Math.min(m, v), Infinity);
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
}
