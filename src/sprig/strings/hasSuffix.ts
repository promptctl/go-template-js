export function hasSuffix(suffix: unknown, s: unknown): boolean {
  return String(s).endsWith(String(suffix));
}
