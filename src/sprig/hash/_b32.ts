/**
 * [LAW:one-source-of-truth] RFC 4648 base32 alphabet and decode table —
 * shared by b32enc and b32dec.
 */

export const ALPHA32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Reverse lookup: character → 5-bit value. */
export const DECODE32: ReadonlyMap<string, number> = new Map(
  Array.from(ALPHA32).map((c, i) => [c, i] as [string, number]),
);
