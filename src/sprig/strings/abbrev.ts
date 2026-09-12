import { runes } from "./runes.js";

/**
 * `abbrev width s` — truncate `s` to `width` chars, replacing the tail
 * with `...` when truncation occurs. Width must be at least 4 to fit
 * the ellipsis; smaller widths return `s` unchanged (Go sprig
 * behavior).
 *
 * `width` counts code points, so the cut never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function abbrev(width: number, s: string): string {
  const cps = runes(s);
  if (cps.length <= width) return s;
  if (width < 4) return s;
  return `${cps.slice(0, width - 3).join("")}...`;
}
