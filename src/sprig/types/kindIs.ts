import { kindOf } from "./kindOf.js";

export function kindIs(kind: unknown, value: unknown): boolean {
  return kindOf(value) === String(kind);
}
