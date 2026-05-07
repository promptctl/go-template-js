// [LAW:single-enforcer] The "list" gate validates array-ness; this
// body trusts the param type. Per Go sprig, `last` accepts lists only
// — strings are not lists, so the previous string fallback is gone.
export function last(list: unknown[]): unknown {
  return list[list.length - 1];
}
