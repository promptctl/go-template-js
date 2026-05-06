/** `cat a b c` — concatenates with spaces, like Go sprig. */
export function cat(...args: unknown[]): string {
  return args.map((a) => String(a)).join(" ");
}
