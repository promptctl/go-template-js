const _dec = new TextDecoder();

/** `b64dec s` — standard base64 decoded back to a UTF-8 string. */
export function b64dec(s: string): string {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return _dec.decode(bytes);
}
