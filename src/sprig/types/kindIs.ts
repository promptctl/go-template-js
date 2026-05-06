import { kindOf } from "./kindOf.js";

export function kindIs(kind: string, value: unknown): boolean {
  return kindOf(value) === kind;
}
