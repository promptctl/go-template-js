import { deepEqual } from "../types/deepEqual.js";

/** `has item list` — true iff `item` ∈ `list`. Note arg order matches Go sprig. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
// [LAW:one-source-of-truth] Element equality routes through `deepEqual`,
// matching Go sprig's `reflect.DeepEqual` (closes audit G4).
export function has(item: unknown, list: unknown[]): boolean {
  return list.some((e) => deepEqual(e, item));
}
