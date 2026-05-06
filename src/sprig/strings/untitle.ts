/** Lowercase the first letter of each whitespace-separated word. */
export function untitle(s: unknown): string {
  return String(s).replace(/\b([A-Z])/g, (m) => m.toLowerCase());
}
