/**
 * `unset d key` — mutates the receiver to drop `key` and returns it.
 * Matches Go sprig: the receiver and the returned value are the same
 * dict.
 *
 * [LAW:single-enforcer] Non-dict receivers are rejected at the gate;
 * see `set.ts` for the rationale.
 */
export function unset(d: Record<string, unknown>, key: string): Record<string, unknown> {
  delete d[key];
  return d;
}
