/** `squote a b c` — like `quote` but single quotes. */
export function squote(...args: unknown[]): string {
  return args.map((a) => `'${String(a)}'`).join(" ");
}
