/** `join sep list` — joins a list with the separator. */
export function join(sep: string, list: unknown): string {
  if (!Array.isArray(list)) return "";
  return list.map((v) => String(v)).join(sep);
}
