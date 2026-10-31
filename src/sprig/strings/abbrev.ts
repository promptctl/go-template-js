import { abbreviateFull } from "./abbreviateFull.js";
import { runes } from "./runes.js";

/**
 * `abbrev width s` — truncate `s` to `width` chars, replacing the tail
 * with `...` when truncation occurs: sprig's guard around
 * goutils.Abbreviate, which is AbbreviateFull at offset 0. Widths below 4
 * cannot fit the ellipsis and return `s` unchanged.
 *
 * `width` counts code points, so the cut never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function abbrev(width: number, s: string): string {
  if (width < 4) return s;
  return abbreviateFull(runes(s), 0, width);
}
