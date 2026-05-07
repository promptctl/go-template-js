/**
 * `omit d k1 k2 …` — sub-dict with the listed keys removed.
 *
 * [LAW:single-enforcer] Receiver type validated at the gate.
 */
export function omit(d: Record<string, unknown>, ...drop: string[]): Record<string, unknown> {
  const set = new Set(drop);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!set.has(k)) out[k] = v;
  }
  return out;
}
