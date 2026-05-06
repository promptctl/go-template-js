import { typeOf } from "./typeOf.js";

export function typeIs(type: string, value: unknown): boolean {
  return typeOf(value) === type;
}
