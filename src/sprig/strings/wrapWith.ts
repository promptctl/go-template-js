import { wrapWithSeparator } from "./wrap.js";

/** `wrapWith width sep s` — wrap to width using `sep` instead of \n. */
export function wrapWith(width: number | bigint, sep: string, s: string): string {
  return wrapWithSeparator(Number(width), sep, s);
}
