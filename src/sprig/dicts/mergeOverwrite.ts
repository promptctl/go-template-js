/**
 * `mergeOverwrite dst src1 src2 …` — like `merge` but later sources
 * overwrite earlier values.
 *
 * [LAW:single-enforcer] Every dict slot is gated as `"dict"`.
 */
export function mergeOverwrite(
  dst: Record<string, unknown>,
  ...sources: Record<string, unknown>[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...dst };
  for (const s of sources) {
    Object.assign(out, s);
  }
  return out;
}
