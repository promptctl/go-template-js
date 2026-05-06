/** `max a b c …` — variadic maximum. */
export function max(...args: unknown[]): number {
  return args.map((v) => Number(v)).reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY);
}
