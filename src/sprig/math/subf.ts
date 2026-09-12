export function subf(a: number, ...rest: number[]): number {
  return rest.reduce((acc, v) => acc - v, a);
}
