export function repeat(n: unknown, s: unknown): string {
  const count = Math.max(0, Number(n));
  return String(s).repeat(count);
}
