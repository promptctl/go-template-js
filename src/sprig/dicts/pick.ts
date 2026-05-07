/**
 * `pick d k1 k2 …` — sub-dict with only the listed keys.
 *
 * [LAW:single-enforcer] Receiver type validated at the gate.
 */
export function pick(d: Record<string, unknown>, ...wanted: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of wanted) {
    if (key in d) out[key] = d[key];
  }
  return out;
}
