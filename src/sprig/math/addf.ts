export function addf(...args: number[]): number {
  return args.reduce((acc, v) => acc + v, 0);
}
