/**
 * `split sep s` — Go sprig oddity: returns a DICT keyed by `_<index>`,
 * not a list. Use `splitList` for the list form.
 *   split "/" "a/b/c" → { _0: "a", _1: "b", _2: "c" }
 */
export function split(sep: unknown, s: unknown): Record<string, string> {
  const parts = String(s).split(String(sep));
  const out: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    out[`_${i}`] = parts[i] as string;
  }
  return out;
}
