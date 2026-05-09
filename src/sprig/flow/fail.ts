/**
 * `fail msg` — unconditionally abort template evaluation with `msg`.
 *
 * Mirrors Go sprig's `fail`, which returns `(string, error)` and causes
 * text/template to stop execution. Throws `FailError` so consumers can
 * catch it specifically and distinguish it from engine errors.
 *
 * [LAW:types-are-the-program] Return type `never` encodes the invariant
 * that this function never returns — the type system enforces what a
 * comment would only suggest.
 */

import { FailError } from "../../errors.js";

export function fail(msg: string): never {
  throw new FailError(msg);
}
