/** `max a b c …` — variadic maximum. */
export function max(...args: (number | bigint)[]): number {
  return args.map((v) => Math.trunc(Number(v))).reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY);
}
