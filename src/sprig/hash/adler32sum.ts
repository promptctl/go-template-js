const _enc = new TextEncoder();
const MOD_ADLER = 65521;

/**
 * `adler32sum s` — Adler-32 checksum of `s` as a decimal string.
 *
 * Matches Go's `hash/adler32.Checksum([]byte(s))` formatted with `%d`.
 * Uses unsigned 32-bit arithmetic via `>>> 0` to mirror Go's uint32 result.
 */
export function adler32sum(s: string): string {
  const bytes = _enc.encode(s);
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return String(((b * 65536) + a) >>> 0);
}
