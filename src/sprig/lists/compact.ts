import { empty } from "../defaults/empty.js";

/** `compact list` — drop empty values per sprig's `empty` rules. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
export function compact(list: unknown[]): unknown[] {
  return list.filter((v) => !empty(v));
}
