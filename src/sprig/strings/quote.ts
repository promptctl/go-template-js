/** `quote a b c` — wraps each arg in double quotes, joined by spaces. */
export function quote(...args: unknown[]): string {
  return args.map((a) => `"${String(a)}"`).join(" ");
}
