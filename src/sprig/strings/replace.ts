import { goSplit } from "./runes.js";

/**
 * Replaces ALL occurrences of `old` with `nw` in `s` (Go's strings.Replace n=-1).
 *
 * An empty `old` splits between runes rather than UTF-16 units, so the
 * replacement is never inserted inside an astral character. Where Go
 * additionally inserts `nw` at both ends (`-a-b-c-` to this port's
 * `a-b-c`) it still differs — a separate, non-Unicode divergence.
 */
export function replace(old: string, nw: string, s: string): string {
  return goSplit(old, s).join(nw);
}
