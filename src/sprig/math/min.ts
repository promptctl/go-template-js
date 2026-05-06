/** `min a b c …` — variadic minimum. */
export function min(...args: unknown[]): number {
  return args.map((v) => Number(v)).reduce((m, v) => (v < m ? v : m), Number.POSITIVE_INFINITY);
}
