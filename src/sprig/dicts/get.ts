/**
 * `get d key` — returns d[key] or undefined.
 *
 * [LAW:single-enforcer] The gate validates `d` is a plain object
 * (`"dict"`); the body trusts the receiver type. The Map case lives in
 * template-laws-3gt.7 (where the slot widens with an explicit Map-key
 * carve-out per audit B5/B6) — until then, Maps are rejected at the
 * gate.
 */
export function get(d: Record<string, unknown>, key: string): unknown {
  return d[key];
}
