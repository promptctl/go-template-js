/** Capitalize the first letter of each whitespace-separated word. */
export function title(s: unknown): string {
  return String(s).replace(/\b([a-zA-Z])/g, (m) => m.toUpperCase());
}
