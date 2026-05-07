import { deepEqual } from "../types/deepEqual.js";

/** Unique values, preserving first-occurrence order. */
// [LAW:single-enforcer] The "list" gate validates array-ness.
// [LAW:one-source-of-truth] Element equality routes through `deepEqual`,
// matching Go sprig's `reflect.DeepEqual` (closes audit G4).
export function uniq(list: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const v of list) if (!out.some((e) => deepEqual(e, v))) out.push(v);
  return out;
}
