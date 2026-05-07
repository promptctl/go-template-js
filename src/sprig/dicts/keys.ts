/**
 * `keys d` — list of own enumerable string keys.
 *
 * [LAW:single-enforcer] Receiver type validated at the gate (`"dict"`);
 * the body trusts the parameter. Maps are rejected by the dict gate —
 * closes audit finding B6 (no silent `String(key)` flattening of
 * typed-T Map keys, because Maps never reach this body).
 */
export function keys(d: Record<string, unknown>): string[] {
  return Object.keys(d);
}
