/**
 * `values d` — list of own enumerable values.
 *
 * [LAW:single-enforcer] Receiver type validated at the gate.
 */
export function values(d: Record<string, unknown>): unknown[] {
  return Object.values(d);
}
