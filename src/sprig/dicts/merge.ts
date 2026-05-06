/**
 * `merge dst src1 src2 …` — copies missing keys from sources into dst,
 * leaving dst's existing keys untouched. Returns a new dict.
 */
export function merge(dst: unknown, ...sources: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(dst && typeof dst === "object" && !(dst instanceof Map)
      ? (dst as Record<string, unknown>)
      : {}),
  };
  for (const s of sources) {
    if (!s || typeof s !== "object" || s instanceof Map) continue;
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      if (!(k in out)) out[k] = v;
    }
  }
  return out;
}
