export function trimSuffix(suffix: string, s: string): string {
  return s.endsWith(suffix) ? s.slice(0, s.length - suffix.length) : s;
}
