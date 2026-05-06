/** `omit d k1 k2 …` — sub-dict with the listed keys removed. */
export function omit(d: unknown, ...drop: unknown[]): Record<string, unknown> {
  if (!d || typeof d !== "object" || d instanceof Map) return {};
  const set = new Set(drop.map(String));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (!set.has(k)) out[k] = v;
  }
  return out;
}
