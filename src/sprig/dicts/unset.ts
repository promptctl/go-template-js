/** `unset d key` — returns a NEW dict without key. */
export function unset(d: unknown, key: string): Record<string, unknown> {
  if (!d || typeof d !== "object" || d instanceof Map) return {};
  const { [key]: _omit, ...rest } = d as Record<string, unknown>;
  return rest;
}
