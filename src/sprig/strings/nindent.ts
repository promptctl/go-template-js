/** `nindent n s` — `indent` with a leading newline. */
import { indent } from "./indent.js";

export function nindent(n: unknown, s: unknown): string {
  return `\n${indent(n, s)}`;
}
