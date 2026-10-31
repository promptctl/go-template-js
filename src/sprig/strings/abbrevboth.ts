import { abbreviateFull } from "./abbreviateFull.js";
import { runes } from "./runes.js";

/**
 * `abbrevboth left right s` — sprig's guard around goutils.AbbreviateFull
 * with `left` as the offset and `right` as the maximum width: a window of
 * `s` near `left`, with `...` at each end that was cut.
 *
 * Offsets count code points, so the window never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function abbrevboth(left: number, right: number, s: string): string {
  if (right < 4 || (left > 0 && right < 7)) return s;
  return abbreviateFull(runes(s), left, right);
}
