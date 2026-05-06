/**
 * `unset d key` — mutates the receiver to drop `key` and returns it.
 * Matches Go sprig: the receiver and the returned value are the same
 * dict. Non-dict receivers are returned unchanged.
 */
export function unset(d: unknown, key: string): unknown {
  if (d && typeof d === "object" && !(d instanceof Map)) {
    delete (d as Record<string, unknown>)[key];
  }
  return d;
}
