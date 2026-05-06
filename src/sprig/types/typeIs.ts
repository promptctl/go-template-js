import { typeOf } from "./typeOf.js";

export function typeIs(type: unknown, value: unknown): boolean {
  return typeOf(value) === String(type);
}
