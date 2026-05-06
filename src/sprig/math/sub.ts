export function sub(a: number | bigint, b: number | bigint): number {
  return Math.trunc(Number(a)) - Math.trunc(Number(b));
}
