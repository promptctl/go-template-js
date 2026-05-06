/** Note: sprig's name is `hasKey` though docs sometimes say `haskey`. */
export function hasKey(d: unknown, key: string): boolean {
  if (d instanceof Map) return d.has(key);
  if (d && typeof d === "object") return key in (d as object);
  return false;
}
