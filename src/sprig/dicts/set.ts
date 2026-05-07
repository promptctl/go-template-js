/**
 * `set d key value` — mutates the receiver to bind `key=value` and
 * returns it. Matches Go sprig: the receiver and the returned value
 * are the same dict.
 *
 * [LAW:single-enforcer] Non-dict receivers are rejected at the gate
 * (`argTypes: ["dict", "string", "value"]`); the body trusts the
 * receiver type. The previous body-level `bodyTypeMismatch` (working-
 * tree fix in template-laws-703.10) became dead code once the slot
 * declared `"dict"` and was deleted in template-laws-3gt.3.
 */
export function set(
  d: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  d[key] = value;
  return d;
}
