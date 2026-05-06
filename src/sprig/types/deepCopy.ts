/**
 * `deepCopy v` — recursive structural clone.
 *
 * Uses `structuredClone` when available; falls back to a JSON
 * round-trip for older targets. The fallback drops functions and
 * symbols — same caveat as JSON.stringify.
 */
export function deepCopy<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
