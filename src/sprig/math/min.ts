/** `min a b c …` — variadic minimum (Go int64 semantics; args arrive truncated). */
export function min(...args: number[]): number {
  return args.reduce((m, v) => (v < m ? v : m), Number.POSITIVE_INFINITY);
}
