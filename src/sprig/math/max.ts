/** `max a b c …` — variadic maximum (Go int64 semantics; args arrive truncated). */
export function max(...args: number[]): number {
  return args.reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY);
}
