export function trimPrefix(prefix: string, s: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}
