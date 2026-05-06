/**
 * Parser error types — minimal surface for the lexer/parser to emit
 * structured failures. The full ergonomic shape (rich messages, source
 * snippets, curated scenarios) is layered on in template-parser-dum.3
 * and template-api-10d.2 — those tickets extend this base, they do not
 * replace it.
 *
 * [LAW:single-enforcer] One error type per failure category. The lexer
 * and parser both emit `ParseError`. The eventual `TemplateError` base
 * (in the API epic) will subsume this — until then, ParseError stands
 * alone with the same shape so the upgrade is additive.
 */

import type { Pos } from "./pos.js";

export interface ParseErrorContext {
  /** What the parser expected at this position. */
  readonly expected?: string;
  /** What was actually found. */
  readonly found?: string;
  /** The original template source — used for snippet extraction in .3. */
  readonly source?: string;
}

export class ParseError extends Error {
  override readonly name = "ParseError";
  readonly pos: Pos;
  readonly expected: string | undefined;
  readonly found: string | undefined;
  readonly source: string | undefined;

  constructor(message: string, pos: Pos, ctx: ParseErrorContext = {}) {
    super(message);
    this.pos = pos;
    this.expected = ctx.expected;
    this.found = ctx.found;
    this.source = ctx.source;
  }
}
