import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** `sha256sum s` — hex-encoded SHA-256 digest of `s` (UTF-8). */
export function sha256sum(s: string): string {
  return bytesToHex(sha256(utf8ToBytes(s)));
}
