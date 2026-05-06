/** `quote a b c` — wraps each arg in double quotes, joined by spaces. */
export function quote(...args: string[]): string {
  return args.map((a) => `"${a}"`).join(" ");
}
