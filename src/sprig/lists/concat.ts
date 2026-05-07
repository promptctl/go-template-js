/** `concat a b c …` — flat-concat lists. */
// [LAW:single-enforcer] The variadic "list" slot validates array-ness
// for every argument; this body trusts the param type and skips the
// per-element Array.isArray guard.
export function concat(...lists: unknown[][]): unknown[] {
  const out: unknown[] = [];
  for (const l of lists) {
    out.push(...l);
  }
  return out;
}
