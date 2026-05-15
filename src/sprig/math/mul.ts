/** `mul a b c …` — variadic integer product. */
export function mul(...args: number[]): number {
  return args.reduce((acc, v) => acc * v, 1);
}
