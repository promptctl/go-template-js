/** `cat a b c` — concatenates with spaces, like Go sprig. */
export function cat(...args: string[]): string {
  return args.join(" ");
}
