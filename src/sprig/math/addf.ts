export function addf(...args: unknown[]): number {
  return args.reduce<number>((acc, v) => acc + Number(v), 0);
}
