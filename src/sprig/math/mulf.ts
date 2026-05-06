export function mulf(...args: (number | bigint)[]): number {
  return args.reduce<number>((acc, v) => acc * Number(v), 1);
}
