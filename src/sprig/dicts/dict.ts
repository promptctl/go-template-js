/** `dict k1 v1 k2 v2 …` — builds a record from alternating key/value pairs. */
export function dict(...kvs: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < kvs.length; i += 2) {
    const key = String(kvs[i]);
    out[key] = kvs[i + 1];
  }
  return out;
}
