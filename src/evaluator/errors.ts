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
  override readonly name: string = "EvalError";
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

/**
 * Thrown when a template references a function the engine's FuncMap
 * has no entry for.
 */
export class FuncNotFoundError extends EvalError {
  override readonly name = "FuncNotFoundError";
  readonly funcName: string;

  constructor(funcName: string, pos: Pos, ctx: EvalErrorContext = {}) {
    super(`function ${JSON.stringify(funcName)} is not registered`, pos, ctx);
    this.funcName = funcName;
  }
}

/**
 * Thrown when a value flows into a function argument whose declared
 * type is incompatible — specifically, when a non-string T flows into
 * a `string` parameter. The asymmetric direction is deliberate: this
 * is the engine's "no silent flatten" architectural commitment.
 */
export class TypeMismatchError extends EvalError {
  override readonly name = "TypeMismatchError";
  readonly funcName: string;
  /** 1-based argument index for human-readable messages. */
  readonly argIndex: number;
  readonly expected: string;
  readonly receivedSummary: string;

  constructor(
    funcName: string,
    argIndex: number,
    expected: string,
    receivedSummary: string,
    pos: Pos,
    ctx: EvalErrorContext = {},
  ) {
    super(
      `function ${JSON.stringify(funcName)} arg ${argIndex}: expected ${expected}, ` +
        `but a ${receivedSummary} flowed in. Pass it through \`unstyled\` (or your ` +
        `engine's flatten function) to convert.`,
      pos,
      ctx,
    );
    this.funcName = funcName;
    this.argIndex = argIndex;
    this.expected = expected;
    this.receivedSummary = receivedSummary;
  }
}
