/**
 * Re-exports from the unified error module.
 *
 * Historical location — code that imported from this path keeps
 * working. New code should import directly from `src/errors.ts`.
 */

export { ParseError, type ParseErrorContext } from "../errors.js";
