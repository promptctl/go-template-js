import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** `sha1sum s` — hex-encoded SHA-1 digest of `s` (UTF-8). */
export function sha1sum(s: string): string {
  return bytesToHex(sha1(utf8ToBytes(s)));
}
