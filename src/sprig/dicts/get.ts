/** `get d key` — returns d[key] or undefined. */
export function get(d: unknown, key: string): unknown {
  if (d instanceof Map) return d.get(key);
  if (d && typeof d === "object") return (d as Record<string, unknown>)[key];
  return undefined;
}
