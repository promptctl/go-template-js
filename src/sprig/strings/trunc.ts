import { runes } from "./runes.js";

/**
 * `trunc n s` — first `n` chars when n>=0; last |n| chars when n<0.
 * Strings shorter than |n| are returned unchanged. Matches Go sprig.
 *
 * `n` counts code points, so truncating never splits an astral
 * character — see `runes.js` for why that differs from Go's bytes.
 */
export function trunc(n: number, s: string): string {
  const cps = runes(s);
  if (n < 0) {
    const k = -n;
    return k >= cps.length ? s : cps.slice(cps.length - k).join("");
  }
  return n >= cps.length ? s : cps.slice(0, n).join("");
}
