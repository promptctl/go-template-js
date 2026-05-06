export function contains(substr: unknown, s: unknown): boolean {
  return String(s).includes(String(substr));
}
