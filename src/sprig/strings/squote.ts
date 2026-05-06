/** `squote a b c` — like `quote` but single quotes. */
export function squote(...args: string[]): string {
  return args.map((a) => `'${a}'`).join(" ");
}
