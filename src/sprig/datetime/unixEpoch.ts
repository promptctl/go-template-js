import { resolveDate } from "./_resolve.js";

/** `unixEpoch t` — seconds since Unix epoch as a decimal string. */
export function unixEpoch(t: unknown): string {
  return String(Math.floor(resolveDate(t).getTime() / 1000));
}
