/** `add a b c …` — variadic integer sum. */
export function add(...args: (number | bigint)[]): number {
  return args.reduce<number>((acc, v) => acc + Math.trunc(Number(v)), 0);
}
