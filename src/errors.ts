/**
 * Unified error hierarchy for go-template-js.
 *
 * [LAW:single-enforcer] One module owns the error class hierarchy.
 * Both parser and evaluator import from here — no duplicate or
 * parallel definitions.
 *
 *   TemplateError (base)
 *   ├── ParseError
 *   └── EvalError
 *       ├── FuncNotFoundError
 *       ├── TypeMismatchError
 *       └── MissingFieldError
 *
 * Every error carries `pos` and `kind` (a discriminator string for
 * machine inspection). Subclasses add structured fields specific to
 * their failure mode. `.toString()` produces a multi-line presentation
 * with source snippet when `source` was supplied.
 */

import type { Pos } from "./parser/pos.js";

export type ErrorKind =
  | "ParseError"
  | "EvalError"
  | "FuncNotFoundError"
  | "TypeMismatchError"
  | "MissingFieldError";

export interface TemplateErrorContext {
  readonly source?: string | undefined;
}

// ---------------------------------------------------------------------------
// Base.
// ---------------------------------------------------------------------------

export class TemplateError extends Error {
  override readonly name: string = "TemplateError";
  readonly kind: ErrorKind = "EvalError";
  readonly pos: Pos;
  readonly source: string | undefined;

  constructor(message: string, pos: Pos, ctx: TemplateErrorContext = {}) {
    super(message);
    this.pos = pos;
    this.source = ctx.source;
  }

  /** 3-line excerpt of the source around the error with caret. */
  get sourceSnippet(): string {
    return this.source ? buildSnippet(this.source, this.pos) : "";
  }

  override toString(): string {
    const head = `${this.name}: ${this.message}\n  at line ${this.pos.line}, column ${this.pos.column}`;
    const snippet = this.sourceSnippet;
    return snippet ? `${head}\n\n${snippet}` : head;
  }
}

// ---------------------------------------------------------------------------
// Parser error.
// ---------------------------------------------------------------------------

export interface ParseErrorContext extends TemplateErrorContext {
  readonly expected?: string;
  readonly found?: string;
}

export class ParseError extends TemplateError {
  override readonly name = "ParseError";
  override readonly kind: ErrorKind = "ParseError";
  readonly expected: string | undefined;
  readonly found: string | undefined;

  constructor(message: string, pos: Pos, ctx: ParseErrorContext = {}) {
    super(message, pos, ctx);
    this.expected = ctx.expected;
    this.found = ctx.found;
  }
}

// ---------------------------------------------------------------------------
// Eval errors.
// ---------------------------------------------------------------------------

export class EvalError extends TemplateError {
  override readonly name: string = "EvalError";
  override readonly kind: ErrorKind = "EvalError";
}

/**
 * Thrown when a template references a function the engine's FuncMap
 * has no entry for. Includes a list of nearest-matching registered
 * names by edit distance — most useful when the failure is a typo.
 */
export class FuncNotFoundError extends EvalError {
  override readonly name = "FuncNotFoundError";
  override readonly kind: ErrorKind = "FuncNotFoundError";
  readonly funcName: string;
  readonly suggestions: readonly string[];

  constructor(
    funcName: string,
    pos: Pos,
    ctx: TemplateErrorContext & { available?: readonly string[] } = {},
  ) {
    const suggestions = nearestMatches(funcName, ctx.available ?? []);
    const tail = suggestions.length === 0 ? "" : ` (did you mean: ${suggestions.join(", ")}?)`;
    super(`function ${JSON.stringify(funcName)} is not registered${tail}`, pos, ctx);
    this.funcName = funcName;
    this.suggestions = suggestions;
  }
}

export class TypeMismatchError extends EvalError {
  override readonly name = "TypeMismatchError";
  override readonly kind: ErrorKind = "TypeMismatchError";
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
    ctx: TemplateErrorContext = {},
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

export class MissingFieldError extends EvalError {
  override readonly name = "MissingFieldError";
  override readonly kind: ErrorKind = "MissingFieldError";
  readonly path: readonly string[];

  constructor(path: readonly string[], pos: Pos, ctx: TemplateErrorContext = {}) {
    super(`field "${path.join(".")}" not found on receiver`, pos, ctx);
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// Snippet builder — pure helper.
// ---------------------------------------------------------------------------

function buildSnippet(source: string, pos: Pos): string {
  const lines = source.split("\n");
  const lineIdx = pos.line - 1;

  const display: { num: number; text: string }[] = [];
  if (lineIdx - 1 >= 0 && lineIdx - 1 < lines.length) {
    display.push({ num: lineIdx, text: lines[lineIdx - 1] ?? "" });
  }
  if (lineIdx >= 0 && lineIdx < lines.length) {
    display.push({ num: lineIdx + 1, text: lines[lineIdx] ?? "" });
  }
  if (lineIdx + 1 < lines.length) {
    display.push({ num: lineIdx + 2, text: lines[lineIdx + 1] ?? "" });
  }
  if (display.length === 0) return "";

  const numWidth = String(display[display.length - 1]?.num ?? 1).length;
  const out: string[] = [];
  for (const d of display) {
    out.push(`   ${String(d.num).padStart(numWidth, " ")} | ${d.text}`);
    if (d.num === pos.line) {
      const gutter = `   ${" ".repeat(numWidth)} | `;
      const caretPad = " ".repeat(Math.max(0, pos.column - 1));
      out.push(`${gutter}${caretPad}^`);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Edit-distance suggestions for FuncNotFoundError.
// ---------------------------------------------------------------------------

function nearestMatches(target: string, candidates: readonly string[]): string[] {
  if (candidates.length === 0) return [];
  const ranked = candidates
    .map((c) => ({ name: c, dist: editDistance(target, c) }))
    .sort((a, b) => a.dist - b.dist);
  // Heuristic: top 3, but only when the closest is within length/2
  // edits — avoid wildly unrelated suggestions when the user typed
  // something nothing like any registered name.
  const cutoff = Math.max(2, Math.floor(target.length / 2));
  return ranked
    .filter((r) => r.dist <= cutoff)
    .slice(0, 3)
    .map((r) => r.name);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j] ?? 0;
  }
  return prev[n] ?? 0;
}
