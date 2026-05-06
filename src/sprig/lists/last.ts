export function last(list: unknown): unknown {
  if (Array.isArray(list)) return list[list.length - 1];
  if (typeof list === "string") return list[list.length - 1];
  return undefined;
}
