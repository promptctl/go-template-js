/** `initials s` — first letter of each whitespace-separated word, uppercased. */
export function initials(s: unknown): string {
  return String(s)
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
