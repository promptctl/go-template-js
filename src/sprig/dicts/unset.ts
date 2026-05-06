/** `unset d key` — returns a NEW dict without key. */
export function unset(d: unknown, key: unknown): Record<string, unknown> {
  if (!d || typeof d !== "object" || d instanceof Map) return {};
  const { [String(key)]: _omit, ...rest } = d as Record<string, unknown>;
  return rest;
}
