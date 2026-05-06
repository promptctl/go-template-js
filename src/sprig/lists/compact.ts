import { empty } from "../defaults/empty.js";

/** `compact list` — drop empty values per sprig's `empty` rules. */
export function compact(list: unknown): unknown[] {
  if (!Array.isArray(list)) return [];
  return list.filter((v) => !empty(v));
}
