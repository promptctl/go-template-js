/** `concat a b c …` — flat-concat lists; non-list args are skipped. */
export function concat(...lists: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const l of lists) {
    if (Array.isArray(l)) out.push(...l);
  }
  return out;
}
