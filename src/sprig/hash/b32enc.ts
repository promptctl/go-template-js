import { ALPHA32 } from "./_b32.js";

const _enc = new TextEncoder();

/** `b32enc s` — UTF-8 bytes of `s` encoded as RFC 4648 base32. */
export function b32enc(s: string): string {
  const bytes = _enc.encode(s);
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHA32[(value >> bits) & 31];
    }
  }
  if (bits > 0) result += ALPHA32[(value << (5 - bits)) & 31];
  while (result.length % 8 !== 0) result += "=";
  return result;
}
