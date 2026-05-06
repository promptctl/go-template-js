/** `trimAll cutset s` — strip leading + trailing chars in `cutset`. */
export function trimAll(cutset: string, s: string): string {
  if (cutset.length === 0) return s;
  const set = new Set([...cutset]);
  let start = 0;
  while (start < s.length && set.has(s[start] as string)) start += 1;
  let end = s.length;
  while (end > start && set.has(s[end - 1] as string)) end -= 1;
  return s.slice(start, end);
}
