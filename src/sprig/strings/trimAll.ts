import { runes } from "./runes.js";

/**
 * `trimAll cutset s` — strip leading + trailing chars in `cutset`.
 *
 * Both sides are compared as code points, matching Go's `strings.Trim`,
 * which decodes the cutset as runes. Scanning `s` by UTF-16 unit
 * compared half an astral character against whole ones, so an astral
 * cutset char never matched and the string came back untrimmed.
 */
export function trimAll(cutset: string, s: string): string {
  if (cutset.length === 0) return s;
  const set = new Set(runes(cutset));
  const cps = runes(s);
  let start = 0;
  while (start < cps.length && set.has(cps[start] as string)) start += 1;
  let end = cps.length;
  while (end > start && set.has(cps[end - 1] as string)) end -= 1;
  return cps.slice(start, end).join("");
}
