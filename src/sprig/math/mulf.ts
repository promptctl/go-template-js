export function mulf(...args: number[]): number {
  return args.reduce((acc, v) => acc * v, 1);
}
