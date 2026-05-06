/** `trimAll cutset s` — strip leading + trailing chars in `cutset`. */
export function trimAll(cutset: unknown, s: unknown): string {
  const cs = String(cutset);
  if (cs.length === 0) return String(s);
  const set = new Set([...cs]);
  const str = String(s);
  let start = 0;
  while (start < str.length && set.has(str[start] as string)) start += 1;
  let end = str.length;
  while (end > start && set.has(str[end - 1] as string)) end -= 1;
  return str.slice(start, end);
}
