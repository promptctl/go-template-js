/** `min a b c …` — variadic minimum; each argument is truncated toward zero (Go int64 semantics) before comparison. */
export function min(...args: (number | bigint)[]): number {
  return args.map((v) => Math.trunc(Number(v))).reduce((m, v) => (v < m ? v : m), Number.POSITIVE_INFINITY);
}
