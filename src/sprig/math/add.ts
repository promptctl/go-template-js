/** `add a b c …` — variadic integer sum. */
export function add(...args: number[]): number {
  return args.reduce((acc, v) => acc + v, 0);
}
