/**
 * `dict k1 v1 k2 v2 …` — builds a record from alternating key/value pairs.
 *
 * [LAW:single-enforcer] The boundary gate (`enforceArgTypes`) validates
 * the kv cycle via `argTypePattern: "alternating"` against
 * `argTypes: ["string", "value"]`, so every key position is a string by
 * the time the body runs. The body trusts the gate; no per-key probe.
 *
 * Odd-length call (`dict "a"`) leaves the last value `undefined` —
 * matches Go sprig.
 */
export function dict(...kvs: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < kvs.length; i += 2) {
    out[kvs[i] as string] = kvs[i + 1];
  }
  return out;
}
