/**
 * `keys d` — list of own enumerable string keys.
 *
 * [LAW:single-enforcer] Receiver type validated at the gate (`"dict"`);
 * the body trusts the parameter. Map-key behavior is template-laws-3gt.7.
 */
export function keys(d: Record<string, unknown>): string[] {
  return Object.keys(d);
}
