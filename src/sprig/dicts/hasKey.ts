/** Note: sprig's name is `hasKey` though docs sometimes say `haskey`. */
export function hasKey(d: unknown, key: unknown): boolean {
  if (d instanceof Map) return d.has(key);
  if (d && typeof d === "object") return String(key) in (d as object);
  return false;
}
