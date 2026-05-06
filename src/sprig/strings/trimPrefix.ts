export function trimPrefix(prefix: unknown, s: unknown): string {
  const p = String(prefix);
  const str = String(s);
  return str.startsWith(p) ? str.slice(p.length) : str;
}
