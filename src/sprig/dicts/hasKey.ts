/**
 * `hasKey d key` — true when `key` is a own-property of `d`.
 *
 * Note: sprig's name is `hasKey` though docs sometimes say `haskey`.
 * [LAW:single-enforcer] Receiver type validated at the gate.
 */
export function hasKey(d: Record<string, unknown>, key: string): boolean {
  return key in d;
}
