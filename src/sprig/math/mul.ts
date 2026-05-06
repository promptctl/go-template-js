/** `mul a b c …` — variadic integer product. */
export function mul(...args: (number | bigint)[]): number {
  return args.reduce<number>((acc, v) => acc * Math.trunc(Number(v)), 1);
}
