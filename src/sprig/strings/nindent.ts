/** `nindent n s` — `indent` with a leading newline. */
import { indent } from "./indent.js";

export function nindent(n: number | bigint, s: string): string {
  return `\n${indent(n, s)}`;
}
