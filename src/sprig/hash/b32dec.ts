import { DECODE32 } from "./_b32.js";

const _dec = new TextDecoder();

/** `b32dec s` — RFC 4648 base32 decoded back to a UTF-8 string. */
export function b32dec(s: string): string {
  const stripped = s.replace(/=+$/, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of stripped) {
    const v = DECODE32.get(c);
    if (v === undefined) throw new Error(`b32dec: invalid character '${c}'`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return _dec.decode(new Uint8Array(bytes));
}
