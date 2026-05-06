/**
 * `mergeOverwrite dst src1 src2 …` — like `merge` but later sources
 * overwrite earlier values.
 */
export function mergeOverwrite(dst: unknown, ...sources: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(dst && typeof dst === "object" && !(dst instanceof Map)
      ? (dst as Record<string, unknown>)
      : {}),
  };
  for (const s of sources) {
    if (!s || typeof s !== "object" || s instanceof Map) continue;
    Object.assign(out, s);
  }
  return out;
}
