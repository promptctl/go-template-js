import { runes } from "./runes.js";

/**
 * `substr i j s` — substring [i, j) with out-of-range clamping.
 * Matches Go sprig's behavior of clamping rather than throwing:
 * negative `end` (and any `end` past the last char) clamps to the
 * string's length; `start` clamps to `[0, end]`.
 *
 * Offsets count code points, so a window never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function substr(start: number, end: number, s: string): string {
  const cps = runes(s);
  const j = end < 0 || end > cps.length ? cps.length : end;
  const i = Math.min(Math.max(0, start), j);
  return cps.slice(i, j).join("");
}
