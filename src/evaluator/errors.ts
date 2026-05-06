/**
 * Evaluation-time error type.
 *
 * [LAW:single-enforcer] Same shape as ParseError so the eventual
 * TemplateError base in the API epic can subsume both with no churn at
 * the call sites.
 */

import type { Pos } from "../parser/pos.js";

export interface EvalErrorContext {
  readonly source?: string | undefined;
}

export class EvalError extends Error {
  override readonly name = "EvalError";
  readonly pos: Pos;
  readonly source: string | undefined;

  constructor(message: string, pos: Pos, ctx: EvalErrorContext = {}) {
    super(message);
    this.pos = pos;
    this.source = ctx.source;
  }

  override toString(): string {
    return `${this.name}: ${this.message}\n  at line ${this.pos.line}, column ${this.pos.column}`;
  }
}
