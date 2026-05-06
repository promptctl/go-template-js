/** `pick d k1 k2 …` — sub-dict with only the listed keys. */
export function pick(d: unknown, ...wanted: unknown[]): Record<string, unknown> {
  if (!d || typeof d !== "object" || d instanceof Map) return {};
  const src = d as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of wanted) {
    const key = String(k);
    if (key in src) out[key] = src[key];
  }
  return out;
}
