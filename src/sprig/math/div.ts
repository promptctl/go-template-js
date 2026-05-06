/** `div a b` — integer division (Go semantics: truncate toward zero). */
export function div(a: unknown, b: unknown): number {
  return Math.trunc(Math.trunc(Number(a)) / Math.trunc(Number(b)));
}
