export function repeat(n: number | bigint, s: string): string {
  const count = Math.max(0, Number(n));
  return s.repeat(count);
}
