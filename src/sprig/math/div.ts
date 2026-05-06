/** `div a b` — integer division (Go semantics: truncate toward zero). */
export function div(a: number | bigint, b: number | bigint): number {
  return Math.trunc(Math.trunc(Number(a)) / Math.trunc(Number(b)));
}
