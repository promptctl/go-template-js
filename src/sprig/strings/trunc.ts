/**
 * `trunc n s` — first `n` chars when n>=0; last |n| chars when n<0.
 * Strings shorter than |n| are returned unchanged. Matches Go sprig.
 */
export function trunc(n: number, s: string): string {
  if (n < 0) {
    const k = -n;
    return k >= s.length ? s : s.slice(s.length - k);
  }
  return n >= s.length ? s : s.slice(0, n);
}
