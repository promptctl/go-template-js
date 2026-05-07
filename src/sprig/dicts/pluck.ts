/**
 * `pluck key d1 d2 …` — collect d[key] from each dict that has it.
 *
 * [LAW:single-enforcer] Every dict slot is gated as `"dict"`; the body
 * trusts each receiver and skips entries that lack the key.
 */
export function pluck(key: string, ...dicts: Record<string, unknown>[]): unknown[] {
  const out: unknown[] = [];
  for (const d of dicts) {
    if (key in d) out.push(d[key]);
  }
  return out;
}
