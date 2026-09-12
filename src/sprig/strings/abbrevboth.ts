import { runes } from "./runes.js";

/**
 * `abbrevboth left right s` — abbreviate from both ends, leaving `...`
 * around the visible window. Mirrors Go sprig's abbrevboth semantics:
 * left/right specify offsets (0-indexed); the result has `...` around
 * a slice taken between them.
 *
 * Offsets count code points, so the window never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function abbrevboth(left: number, right: number, s: string): string {
  const cps = runes(s);
  if (right < 7 || cps.length < right) return s;
  if (left < 0 || left > cps.length - right + 1) return s;
  return `...${cps.slice(left, left + right - 6).join("")}...`;
}
