/** `indent n s` — prefix every line of `s` with `n` spaces. */
export function indent(n: number | bigint, s: string): string {
  const pad = " ".repeat(Math.max(0, Number(n)));
  return s
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}
