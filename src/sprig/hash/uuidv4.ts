/**
 * `uuidv4` — RFC 4122 v4 UUID via `globalThis.crypto.randomUUID()`.
 *
<<<<<<< HEAD
 * Available in Node >= 20 (per package.json engines), Bun, Deno, and all
 * modern browsers. Throws if the runtime lacks `crypto.randomUUID`.
=======
 * Available in Node >= 14.17, Bun, Deno, and all modern browsers.
 * Throws if the runtime lacks `crypto.randomUUID` — this should never
 * happen in the supported environment set (Node >= 20).
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)
 */
export function uuidv4(): string {
  // [LAW:no-defensive-null-guards] We assert availability rather than silently
  // falling back: a missing crypto.randomUUID is a configuration problem that
  // should surface loudly, not be papered over with a Math.random fallback.
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("uuidv4: globalThis.crypto.randomUUID is not available");
  }
  return globalThis.crypto.randomUUID();
}
