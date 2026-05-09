/** `max a b c …` — variadic maximum; each argument is truncated toward zero (Go int64 semantics) before comparison. */
export function max(...args: (number | bigint)[]): number {
  return args.map((v) => Math.trunc(Number(v))).reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY);
}
