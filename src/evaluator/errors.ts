/**
 * Re-exports from the unified error module, plus a small helper for
 * constructing `TypeMismatchError` from inside sprig func bodies.
 *
 * Historical location — code that imported from this path keeps
 * working. New code should import directly from `src/errors.ts`.
 */

import { TypeMismatchError } from "../errors.js";

export {
  EvalError,
  FuncNotFoundError,
  MissingFieldError,
  TemplateError,
  TypeMismatchError,
} from "../errors.js";

const NO_POS = { line: 0, column: 0, offset: 0 } as const;

/**
 * Construct a TypeMismatchError from inside a registered func body,
 * where the call-site `pos` is unavailable. The dispatch site
 * (`evalCommand`) catches this and re-emits with the correct pos —
 * see [LAW:single-enforcer] in evaluator.ts.
 *
 * Use when the gate cannot validate (nested elements, alternating
 * variadic positions). For first-class arg validation, declare the
 * type in `argTypes` so `enforceArgTypes` catches it at the boundary.
 */
export function bodyTypeMismatch(
  funcName: string,
  argIndex: number,
  expected: string,
  receivedSummary: string,
): TypeMismatchError {
  return new TypeMismatchError(funcName, argIndex, expected, receivedSummary, NO_POS);
}
