/**
 * `trunc n s` — first `n` chars when n>=0; last |n| chars when n<0.
 * Strings shorter than |n| are returned unchanged. Matches Go sprig.
 */
export function trunc(n: number | bigint, s: string): string {
  const len = Number(n);
  if (Number.isNaN(len)) return s;
  if (len < 0) {
    const k = -len;
    return k >= s.length ? s : s.slice(s.length - k);
  }
  return len >= s.length ? s : s.slice(0, len);
}
