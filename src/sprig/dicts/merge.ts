/**
 * `merge dst src1 src2 …` — copies missing keys from sources into dst,
 * leaving dst's existing keys untouched. Returns a new dict.
 *
 * [LAW:single-enforcer] Every dict slot is gated as `"dict"` (variadic
 * trailing-repeat), so dst and every source are plain objects by the
 * time the body runs.
 */
export function merge(
  dst: Record<string, unknown>,
  ...sources: Record<string, unknown>[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...dst };
  for (const s of sources) {
    for (const [k, v] of Object.entries(s)) {
      if (!(k in out)) out[k] = v;
    }
  }
  return out;
}
