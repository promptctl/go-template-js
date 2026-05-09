const _enc = new TextEncoder();

/** `b64enc s` — UTF-8 bytes of `s` encoded as standard base64. */
export function b64enc(s: string): string {
  const bytes = _enc.encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
