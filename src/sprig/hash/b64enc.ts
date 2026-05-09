const _enc = new TextEncoder();

/** `b64enc s` — UTF-8 bytes of `s` encoded as standard base64. */
export function b64enc(s: string): string {
  const bytes = _enc.encode(s);
  const chars = [];
  for (const b of bytes) chars.push(String.fromCharCode(b));
  return btoa(chars.join(""));
}
