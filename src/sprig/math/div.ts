/** `div a b` — integer division (Go semantics: truncate toward zero). */
export function div(a: number, b: number): number {
  return Math.trunc(a / b);
}
