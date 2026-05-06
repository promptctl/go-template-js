/**
 * `trunc n s` — first `n` chars when n>=0; last |n| chars when n<0.
 * Strings shorter than |n| are returned unchanged. Matches Go sprig.
 */
export function trunc(n: unknown, s: unknown): string {
  const str = String(s);
  const len = Number(n);
  if (Number.isNaN(len)) return str;
  if (len < 0) {
    const k = -len;
    return k >= str.length ? str : str.slice(str.length - k);
  }
  return len >= str.length ? str : str.slice(0, len);
}
