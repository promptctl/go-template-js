import { toString } from "./toString.js";

/**
 * `toStrings list` — map each element through `toString`.
 *
 * The `"list"` gate validates array-ness once; this body trusts it
 * and only routes the per-element conversion.
 */
// [LAW:single-enforcer] List shape is the gate's job; per-element
// conversion is `toString`'s job. This function only composes.
export function toStrings(list: unknown[]): string[] {
  return list.map(toString);
}
