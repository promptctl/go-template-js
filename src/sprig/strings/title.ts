/** Capitalize the first letter of each whitespace-separated word. */
export function title(s: string): string {
  return s.replace(/\b([a-zA-Z])/g, (m) => m.toUpperCase());
}
