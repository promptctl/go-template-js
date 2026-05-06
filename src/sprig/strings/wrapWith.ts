import { wrapWithSeparator } from "./wrap.js";

/** `wrapWith width sep s` — wrap to width using `sep` instead of \n. */
export function wrapWith(width: unknown, sep: unknown, s: unknown): string {
  return wrapWithSeparator(Number(width), String(sep), String(s));
}
