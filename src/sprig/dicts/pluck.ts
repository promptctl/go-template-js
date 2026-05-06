/** `pluck key d1 d2 …` — collect d[key] from each dict. */
export function pluck(key: string, ...dicts: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const d of dicts) {
    if (d instanceof Map && d.has(key)) out.push(d.get(key));
    else if (d && typeof d === "object" && key in (d as object)) {
      out.push((d as Record<string, unknown>)[key]);
    }
  }
  return out;
}
