export function mulf(...args: unknown[]): number {
  return args.reduce<number>((acc, v) => acc * Number(v), 1);
}
