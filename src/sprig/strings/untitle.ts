/** Lowercase the first letter of each whitespace-separated word. */
export function untitle(s: string): string {
  return s.replace(/\b([A-Z])/g, (m) => m.toLowerCase());
}
