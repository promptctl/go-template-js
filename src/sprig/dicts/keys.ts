export function keys(d: unknown): string[] {
  if (d instanceof Map) return [...d.keys()].map(String);
  if (d && typeof d === "object") return Object.keys(d);
  return [];
}
