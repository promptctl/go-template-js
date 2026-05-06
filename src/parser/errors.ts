/**
 * Parser error type with source-position context and human-readable
 * formatting.
 *
 * [LAW:single-enforcer] Snippet extraction and message formatting live
 * here on `ParseError` only. The lexer and parser create errors with
 * structured fields (`pos`, `expected`, `found`, `source`); the
 * presentation is owned by this module so a future `EvalError` /
 * `TemplateError` shares the same formatter.
 *
 * [LAW:one-source-of-truth] `pos` is the canonical position for the
 * error; `sourceSnippet` is *derived* from `source` + `pos` lazily and
 * never set independently — that prevents the snippet from drifting
 * out of agreement with the position fields.
 */

import type { Pos } from "./pos.js";

export interface ParseErrorContext {
  /** What the parser expected at this position. */
  readonly expected?: string;
  /** What was actually found. */
  readonly found?: string;
  /** Original template source — required to render `sourceSnippet`. */
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

  /**
   * 3-line excerpt of the source around the error, with a caret line
   * pointing at the failing column. Empty string when no source was
   * supplied.
   */
  get sourceSnippet(): string {
    return this.source ? buildSnippet(this.source, this.pos) : "";
  }

  /**
   * Multi-line formatted message:
   *
   *   ParseError: <message>
   *     at line <L>, column <C>
   *
   *      <L-1> | <prev line>
   *      <L>   | <error line>
   *                  ^
   *      <L+1> | <next line>
   */
  override toString(): string {
    const head = `${this.name}: ${this.message}\n  at line ${this.pos.line}, column ${this.pos.column}`;
    const snippet = this.sourceSnippet;
    return snippet ? `${head}\n\n${snippet}` : head;
  }
}

// ---------------------------------------------------------------------------
// Snippet builder — pure, depends only on `source` and `pos`.
// ---------------------------------------------------------------------------

function buildSnippet(source: string, pos: Pos): string {
  const lines = source.split("\n");
  const lineIdx = pos.line - 1;

  // Lines we want to display: the error line plus one before/after when
  // present. Out-of-range lines (lineIdx negative or beyond the source)
  // collapse to an empty display rather than throwing.
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

  // Right-align line numbers to the widest displayed number for a
  // clean column.
  const numWidth = String(display[display.length - 1]?.num ?? 1).length;
  const out: string[] = [];
  for (const d of display) {
    out.push(`   ${String(d.num).padStart(numWidth, " ")} | ${d.text}`);
    if (d.num === pos.line) {
      // Caret line — `   <numWidth pad> | ` is the gutter, then we
      // pad to the target column with spaces and place a caret.
      const gutter = `   ${" ".repeat(numWidth)} | `;
      const caretPad = " ".repeat(Math.max(0, pos.column - 1));
      out.push(`${gutter}${caretPad}^`);
    }
  }
  return out.join("\n");
}
