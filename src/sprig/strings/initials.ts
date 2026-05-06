/** `initials s` — first letter of each whitespace-separated word, uppercased. */
export function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
