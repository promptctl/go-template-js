/**
 * `set d key value` — returns a NEW dict with key=value. Sprig mutates
 * its target in Go; for JS-side immutability we return a copy. The
 * mutating form is rarely needed in templates.
 */
export function set(d: unknown, key: string, value: unknown): Record<string, unknown> {
  const base =
    d && typeof d === "object" && !(d instanceof Map) ? (d as Record<string, unknown>) : {};
  return { ...base, [key]: value };
}
