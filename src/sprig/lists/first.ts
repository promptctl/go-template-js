export function first(list: unknown): unknown {
  if (Array.isArray(list)) return list[0];
  if (typeof list === "string") return list[0];
  return undefined;
}
