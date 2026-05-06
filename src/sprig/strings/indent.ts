/** `indent n s` — prefix every line of `s` with `n` spaces. */
export function indent(n: unknown, s: unknown): string {
  const pad = " ".repeat(Math.max(0, Number(n)));
  return String(s)
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}
