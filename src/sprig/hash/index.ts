/**
 * Sprig hash, encoding, and UUID functions — `b64enc`, `b64dec`, `b32enc`,
 * `b32dec`, `sha1sum`, `sha256sum`, `sha512sum`, `adler32sum`, `uuidv4`.
 *
 * All functions are pure and synchronous. SHA-* use @noble/hashes (audited,
 * zero-dep, ~5 KB gzipped per family); encoding is hand-rolled per RFC 4648;
 * UUID uses globalThis.crypto.randomUUID.
 *
 * [LAW:single-enforcer] FuncMap registration is the only place that maps
 * sprig template names to implementations.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { adler32sum } from "./adler32sum.js";
import { b32dec } from "./b32dec.js";
import { b32enc } from "./b32enc.js";
import { b64dec } from "./b64dec.js";
import { b64enc } from "./b64enc.js";
import { sha1sum } from "./sha1sum.js";
import { sha256sum } from "./sha256sum.js";
import { sha512sum } from "./sha512sum.js";
import { uuidv4 } from "./uuidv4.js";

export { adler32sum, b32dec, b32enc, b64dec, b64enc, sha1sum, sha256sum, sha512sum, uuidv4 };

/** Build the sprig hash/encoding FuncMap. */
export function sprigHash(): FuncMap {
  return {
    b64enc: { fn: (s) => b64enc(s as string), argTypes: ["string"] },
    b64dec: { fn: (s) => b64dec(s as string), argTypes: ["string"] },
    b32enc: { fn: (s) => b32enc(s as string), argTypes: ["string"] },
    b32dec: { fn: (s) => b32dec(s as string), argTypes: ["string"] },
    sha1sum: { fn: (s) => sha1sum(s as string), argTypes: ["string"] },
    sha256sum: { fn: (s) => sha256sum(s as string), argTypes: ["string"] },
    sha512sum: { fn: (s) => sha512sum(s as string), argTypes: ["string"] },
    adler32sum: { fn: (s) => adler32sum(s as string), argTypes: ["string"] },
    uuidv4: { fn: () => uuidv4(), argTypes: [] },
  };
}
