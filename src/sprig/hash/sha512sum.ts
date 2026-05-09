import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** `sha512sum s` — hex-encoded SHA-512 digest of `s` (UTF-8). */
export function sha512sum(s: string): string {
  return bytesToHex(sha512(utf8ToBytes(s)));
}
