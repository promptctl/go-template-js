/**
 * `set d key value` — mutates the receiver to bind `key=value` and
 * returns it. Matches Go sprig's behavior: the receiver and the
 * returned value are the same dict. Non-dict receivers (null, primitives,
 * Maps) are returned unchanged.
 */
export function set(d: unknown, key: string, value: unknown): unknown {
  if (d && typeof d === "object" && !(d instanceof Map)) {
    (d as Record<string, unknown>)[key] = value;
  }
  return d;
}
