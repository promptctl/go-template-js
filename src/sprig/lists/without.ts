import { deepEqual } from "../types/deepEqual.js";

/** `without list a b c …` — drop any of a/b/c… from list. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
// [LAW:one-source-of-truth] Element equality routes through `deepEqual`,
// matching Go sprig's `reflect.DeepEqual` (closes audit G4).
export function without(list: unknown[], ...exclude: unknown[]): unknown[] {
  return list.filter((v) => !exclude.some((e) => deepEqual(e, v)));
}
