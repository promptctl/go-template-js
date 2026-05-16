/** `minf a b c …` — variadic float-typed minimum. Float counterpart of `min` (int64-truncated). */
export function minf(...args: number[]): number {
  return args.reduce((m, v) => Math.min(m, v), Infinity);
}
