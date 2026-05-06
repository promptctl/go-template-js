export function values(d: unknown): unknown[] {
  if (d instanceof Map) return [...d.values()];
  if (d && typeof d === "object") return Object.values(d);
  return [];
}
