import { wrapWithSeparator } from "./wrap.js";

/** `wrapWith width sep s` — wrap to width using `sep` instead of \n. */
export function wrapWith(width: number, sep: string, s: string): string {
  return wrapWithSeparator(width, sep, s);
}
