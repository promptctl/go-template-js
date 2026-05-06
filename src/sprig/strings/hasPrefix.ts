export function hasPrefix(prefix: unknown, s: unknown): boolean {
  return String(s).startsWith(String(prefix));
}
