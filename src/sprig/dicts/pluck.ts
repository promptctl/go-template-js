/** `pluck key d1 d2 …` — collect d[key] from each dict. */
export function pluck(key: unknown, ...dicts: unknown[]): unknown[] {
  const k = String(key);
  const out: unknown[] = [];
  for (const d of dicts) {
    if (d instanceof Map && d.has(k)) out.push(d.get(k));
    else if (d && typeof d === "object" && k in (d as object)) {
      out.push((d as Record<string, unknown>)[k]);
    }
  }
  return out;
}
