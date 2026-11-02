/**
 * goutils.AbbreviateFull (Masterminds/goutils@v1.1.1 stringutils.go), the
 * function behind both sprig `abbrev` and `abbrevboth`: keep at most
 * `maxWidth` characters of `cps`, starting near `offset`, marking each cut
 * end with `...`.
 *
 * [LAW:one-source-of-truth] Ported whole, step for step in Go's order, so
 * both sprig wrappers share Go's one control flow instead of each
 * reconstructing the branch it noticed. Indexed by code point where Go
 * indexes by byte — see `runes.js`.
 *
 * Go returns an error at its two minimum-width checks; both sprig wrappers
 * guard against reaching them, so here they throw rather than model sprig's
 * swallowed error.
 */
export function abbreviateFull(cps: readonly string[], offset: number, maxWidth: number): string {
  if (cps.length === 0) return "";
  if (maxWidth < 4) {
    throw new Error("stringutils illegal argument: Minimum abbreviation width is 4");
  }
  if (cps.length <= maxWidth) return cps.join("");
  // Go's two offset clamps, to the length and then so that maxWidth-3
  // characters remain; past the check above the second is always tighter.
  const start = Math.min(offset, cps.length - (maxWidth - 3));
  if (start <= 4) return `${cps.slice(0, maxWidth - 3).join("")}...`;
  if (maxWidth < 7) {
    throw new Error("stringutils illegal argument: Minimum abbreviation width with offset is 7");
  }
  if (start + maxWidth - 3 < cps.length) {
    return `...${abbreviateFull(cps.slice(start), 0, maxWidth - 3)}`;
  }
  return `...${cps.slice(cps.length - (maxWidth - 3)).join("")}`;
}
