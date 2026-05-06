import { typeIs } from "./typeIs.js";

/**
 * `typeIsLike type v` — Go sprig's "like" matches both value and
 * pointer-to-value. JS doesn't have pointers so this collapses to
 * `typeIs`.
 */
export function typeIsLike(type: unknown, value: unknown): boolean {
  return typeIs(type, value);
}
