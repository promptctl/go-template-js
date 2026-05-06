/**
 * Recursive-descent parser for Go-template syntax.
 *
 * [LAW:dataflow-not-control-flow] The parser is a single class whose
 * methods read the token stream and emit AST nodes. There are no
 * conditional code paths that produce *different program structure* —
 * every grammar production is one method whose shape is fixed; the
 * variability is in the token values it observes.
 *
 * [LAW:single-enforcer] All token consumption goes through `next` /
 * `peek` / `expect`. No grammar production reaches into the lexer
 * directly — that would let two productions disagree about position
 * tracking or lookahead state.
 */

import type {
  ActionNode,
  BlockNode,
  BoolNode,
  ChainNode,
  CommandNode,
  CommentNode,
  DotNode,
  FieldNode,
  IdentifierNode,
  IfNode,
  ListNode,
  NilNode,
  Node,
  NumberNode,
  PipeNode,
  RangeNode,
  StringNode,
  TemplateNode,
  TextNode,
  TrimMarkers,
  VariableNode,
  WithNode,
} from "./ast.js";
import { ParseError } from "./errors.js";
import { Lexer, type Token, type TokenType } from "./lexer.js";
import type { Pos } from "./pos.js";

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export interface ParseResult {
  /** The body of the unnamed/root template. */
  readonly root: ListNode;
  /** Templates created by `{{define "name"}}...{{end}}` blocks. */
  readonly defines: ReadonlyMap<string, ListNode>;
  /** Original source text — preserved for error snippets and Template.source. */
  readonly source: string;
}

export function parse(source: string): ParseResult {
  const parser = new Parser(source);
  return parser.parseTemplate();
}

// ---------------------------------------------------------------------------
// Internals.
// ---------------------------------------------------------------------------

class Parser {
  private readonly lex: Lexer;
  private readonly buf: Token[] = [];
  private readonly defines = new Map<string, ListNode>();
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
    this.lex = new Lexer(source);
  }

  // -------------------------------------------------------------------
  // Token stream helpers.
  // -------------------------------------------------------------------

  private peek(n = 0): Token {
    while (this.buf.length <= n) {
      this.buf.push(this.lex.next());
    }
    // [LAW:no-defensive-null-guards] We just filled the buffer to n+1
    // entries, so buf[n] is non-undefined by construction. Cast rather
    // than guard — the alternative throw would be unreachable.
    return this.buf[n] as Token;
  }

  private next(): Token {
    if (this.buf.length > 0) return this.buf.shift() as Token;
    return this.lex.next();
  }

  private expect(type: TokenType, what: string): Token {
    const t = this.next();
    if (t.type !== type) {
      throw this.errAt(t, `expected ${what}`, { expected: what, found: tokenLabel(t) });
    }
    return t;
  }

  private errAt(
    t: Token,
    message: string,
    extra: { expected?: string; found?: string } = {},
  ): ParseError {
    return new ParseError(message, t.pos, {
      ...extra,
      source: this.source,
    });
  }

  // -------------------------------------------------------------------
  // Top-level.
  // -------------------------------------------------------------------

  parseTemplate(): ParseResult {
    const root = this.parseList();
    if (this.peek().type !== "EOF") {
      const left = this.peek();
      // We only stop in parseList for stray `{{else}}` or `{{end}}`.
      // Surface that as a curated message rather than the generic
      // "unexpected `{{`" we'd otherwise emit.
      const inside = this.peek(1);
      if (left.type === "LeftDelim" && (inside.type === "Else" || inside.type === "End")) {
        const keyword = inside.type === "Else" ? "else" : "end";
        throw this.errAt(
          left,
          `unexpected \`{{${keyword}}}\` outside of \`if\`, \`range\`, \`with\`, or \`block\``,
          { found: `{{${keyword}}}` },
        );
      }
      throw this.errAt(left, `unexpected ${tokenLabel(left)}`, { found: tokenLabel(left) });
    }
    return { root, defines: this.defines, source: this.source };
  }

  // -------------------------------------------------------------------
  // List body — runs until EOF or a branch terminator (else/end).
  // -------------------------------------------------------------------

  private parseList(): ListNode {
    const startPos = this.peek().pos;
    const nodes: Node[] = [];
    while (true) {
      const t = this.peek();
      if (t.type === "EOF") break;
      if (t.type === "Text") {
        this.next();
        nodes.push({ type: "Text", pos: t.pos, text: t.value } satisfies TextNode);
        continue;
      }
      if (t.type === "Comment") {
        this.next();
        const trim = trimFromToken(t);
        nodes.push({ type: "Comment", pos: t.pos, text: t.value, trim } satisfies CommentNode);
        continue;
      }
      if (t.type === "LeftDelim") {
        // Branch terminators stop the list without consuming the delim.
        const inside = this.peek(1).type;
        if (inside === "Else" || inside === "End") return finishList(startPos, nodes);
        const action = this.parseAction();
        if (action !== null) nodes.push(action);
        continue;
      }
      throw this.errAt(t, `unexpected ${tokenLabel(t)} at top level`, {
        found: tokenLabel(t),
      });
    }
    return finishList(startPos, nodes);
  }

  // -------------------------------------------------------------------
  // Action body — dispatched on the keyword right after `{{`.
  //
  // Returns null when the action consumed is a `{{define}}` block, since
  // defines are stashed in the parser's defines map rather than added to
  // the surrounding list.
  // -------------------------------------------------------------------

  private parseAction(): Node | null {
    const left = this.expect("LeftDelim", "`{{`");
    const trimLeft = left.trimLeft === true;
    const head = this.peek();

    switch (head.type) {
      case "If":
        this.next();
        return this.parseBranch("If", left.pos, trimLeft);
      case "Range":
        this.next();
        return this.parseBranch("Range", left.pos, trimLeft);
      case "With":
        this.next();
        return this.parseBranch("With", left.pos, trimLeft);
      case "Template":
        this.next();
        return this.parseTemplateInvocation(left.pos, trimLeft);
      case "Block":
        this.next();
        return this.parseBlock(left.pos, trimLeft);
      case "Define":
        this.next();
        this.parseDefine(left.pos, trimLeft);
        return null;
      case "RightDelim":
        // Empty action `{{}}` is illegal in Go's parser.
        throw this.errAt(head, "empty action", { expected: "pipeline" });
      default: {
        // A plain pipeline action: `{{ pipeline }}`.
        const pipe = this.parsePipeline();
        const right = this.expect("RightDelim", "`}}`");
        return {
          type: "Action",
          pos: left.pos,
          pipe,
          trim: { trimLeft, trimRight: right.trimRight === true },
        } satisfies ActionNode;
      }
    }
  }

  // -------------------------------------------------------------------
  // Branches: if / range / with.
  //
  // Shape: `{{if PIPE}} list ({{else if PIPE}} list)* ({{else}} list)? {{end}}`.
  // The `else if` chain is desugared into nested IfNodes inside the
  // outer if's elseList, matching Go's parse package.
  // -------------------------------------------------------------------

  private parseBranch(
    kind: "If" | "Range" | "With",
    startPos: Pos,
    trimLeft: boolean,
  ): IfNode | RangeNode | WithNode {
    const pipe = this.parsePipeline();
    this.expect("RightDelim", "`}}`");
    const list = this.parseList();
    const elsePart = this.parseElsePart();
    const endRight = elsePart.endConsumed ? elsePart.endRight : this.consumeEnd();
    const trim: TrimMarkers = { trimLeft, trimRight: endRight };

    const base = elsePart.list
      ? { pipe, list, elseList: elsePart.list, trim }
      : { pipe, list, trim };
    switch (kind) {
      case "If":
        return { type: "If", pos: startPos, ...base } satisfies IfNode;
      case "Range":
        return { type: "Range", pos: startPos, ...base } satisfies RangeNode;
      case "With":
        return { type: "With", pos: startPos, ...base } satisfies WithNode;
    }
  }

  /**
   * Parse the `{{else}}` / `{{else if PIPE}}` segment, if any.
   *
   * `else if` is desugared into a nested IfNode wrapped in the elseList.
   * The recursive parseBranch consumes the chain's single closing
   * `{{end}}`, so the outer caller must NOT consume another — hence the
   * `endConsumed` flag we propagate back.
   */
  private parseElsePart(): {
    list: ListNode | undefined;
    endRight: boolean;
    endConsumed: boolean;
  } {
    if (this.peek().type !== "LeftDelim" || this.peek(1).type !== "Else") {
      return { list: undefined, endRight: false, endConsumed: false };
    }
    const left = this.next(); // {{
    this.next(); // else
    if (this.peek().type === "If") {
      this.next(); // if
      const innerIf = this.parseBranch("If", left.pos, left.trimLeft === true);
      return {
        list: { type: "List", pos: left.pos, nodes: [innerIf] },
        endRight: innerIf.trim.trimRight,
        endConsumed: true,
      };
    }
    this.expect("RightDelim", "`}}`");
    const list = this.parseList();
    return { list, endRight: false, endConsumed: false };
  }

  /** Consume the closing `{{end}}` and return whether it was a `-}}`. */
  private consumeEnd(): boolean {
    this.expect("LeftDelim", "`{{end}}`");
    this.expect("End", "`end`");
    const right = this.expect("RightDelim", "`}}`");
    return right.trimRight === true;
  }

  // -------------------------------------------------------------------
  // Sub-templates: template / block / define.
  // -------------------------------------------------------------------

  private parseTemplateInvocation(startPos: Pos, trimLeft: boolean): TemplateNode {
    const name = this.parseQuotedName();
    const pipe = this.peek().type === "RightDelim" ? undefined : this.parsePipeline();
    const right = this.expect("RightDelim", "`}}`");
    const trim: TrimMarkers = { trimLeft, trimRight: right.trimRight === true };
    return pipe
      ? ({ type: "Template", pos: startPos, name, pipe, trim } satisfies TemplateNode)
      : ({ type: "Template", pos: startPos, name, trim } satisfies TemplateNode);
  }

  private parseBlock(startPos: Pos, trimLeft: boolean): BlockNode {
    const name = this.parseQuotedName();
    const pipe = this.peek().type === "RightDelim" ? undefined : this.parsePipeline();
    this.expect("RightDelim", "`}}`");
    const list = this.parseList();
    const endRight = this.consumeEnd();
    const trim: TrimMarkers = { trimLeft, trimRight: endRight };
    // Block both registers a default body under `name` AND invokes it.
    // A preceding `{{define}}` for the same name takes precedence —
    // the block body is the fallback, not the override.
    if (!this.defines.has(name)) {
      this.defines.set(name, list);
    }
    return pipe
      ? ({ type: "Block", pos: startPos, name, pipe, list, trim } satisfies BlockNode)
      : ({ type: "Block", pos: startPos, name, list, trim } satisfies BlockNode);
  }

  private parseDefine(_startPos: Pos, _trimLeft: boolean): void {
    const name = this.parseQuotedName();
    this.expect("RightDelim", "`}}`");
    const list = this.parseList();
    this.consumeEnd();
    if (this.defines.has(name)) {
      throw new ParseError(`redefinition of template ${JSON.stringify(name)}`, list.pos, {
        source: this.source,
      });
    }
    this.defines.set(name, list);
  }

  private parseQuotedName(): string {
    const t = this.next();
    if (t.type !== "String") {
      throw this.errAt(t, "expected template name (quoted string)", {
        expected: "string",
        found: tokenLabel(t),
      });
    }
    return decodeStringLiteral(t.value, t.pos, this.source);
  }

  // -------------------------------------------------------------------
  // Pipelines.
  //
  //   pipeline := decls? command (`|` command)*
  //   decls    := variable (`,` variable)* (`:=` | `=`)
  // -------------------------------------------------------------------

  private parsePipeline(): PipeNode {
    const startPos = this.peek().pos;
    const decls = this.tryParseDecls();
    const cmds: CommandNode[] = [this.parseCommand()];
    while (this.peek().type === "Pipe") {
      this.next();
      const next = this.peek();
      if (!canStartPrimary(next.type)) {
        throw this.errAt(next, "missing command after `|`", {
          expected: "command",
          found: tokenLabel(next),
        });
      }
      cmds.push(this.parseCommand());
    }
    return {
      type: "Pipe",
      pos: startPos,
      decls: decls?.vars ?? [],
      isAssign: decls?.isAssign ?? false,
      cmds,
    };
  }

  private tryParseDecls(): { vars: VariableNode[]; isAssign: boolean } | undefined {
    if (this.peek().type !== "Variable") return undefined;
    // We have to be conservative here — `$x` could be the start of a
    // declaration *or* a plain pipeline whose first command is just a
    // variable reference. Distinguish by scanning ahead for `:=` / `=`
    // (possibly through `, $y` chains).
    let n = 1;
    while (this.peek(n).type === "Comma") {
      if (this.peek(n + 1).type !== "Variable") return undefined;
      n += 2;
    }
    const opType = this.peek(n).type;
    if (opType !== "Declare" && opType !== "Assign") return undefined;

    const vars: VariableNode[] = [varFromToken(this.next() as Token)];
    while (this.peek().type === "Comma") {
      this.next();
      vars.push(varFromToken(this.expect("Variable", "$variable")));
    }
    const op = this.next();
    return { vars, isAssign: op.type === "Assign" };
  }

  // -------------------------------------------------------------------
  // Commands and primaries.
  //
  //   command := primary+
  //   primary := dot | field | variable | identifier | string | number
  //            | char | bool | nil | `(` pipeline `)` (`.field`)*
  // -------------------------------------------------------------------

  private parseCommand(): CommandNode {
    const startPos = this.peek().pos;
    const args: Node[] = [this.parsePrimary()];
    while (canStartPrimary(this.peek().type)) {
      args.push(this.parsePrimary());
    }
    return { type: "Command", pos: startPos, args };
  }

  private parsePrimary(): Node {
    const t = this.next();
    switch (t.type) {
      case "Dot":
        return { type: "Dot", pos: t.pos } satisfies DotNode;
      case "Field":
        return {
          type: "Field",
          pos: t.pos,
          idents: t.value.slice(1).split("."),
        } satisfies FieldNode;
      case "Variable":
        return varFromToken(t);
      case "Identifier":
        return { type: "Identifier", pos: t.pos, ident: t.value } satisfies IdentifierNode;
      case "String":
        return {
          type: "String",
          pos: t.pos,
          raw: t.value,
          value: decodeStringLiteral(t.value, t.pos, this.source),
        } satisfies StringNode;
      case "Number":
        return numberFromToken(t);
      case "Char":
        // Treat runes as numbers — Go's parser does the same; the rune
        // value is the integer code point. We synthesize a NumberNode
        // with the original char-literal text preserved.
        return runeNumberFromToken(t, this.source);
      case "Bool":
        return { type: "Bool", pos: t.pos, value: t.value === "true" } satisfies BoolNode;
      case "Nil":
        return { type: "Nil", pos: t.pos } satisfies NilNode;
      case "LeftParen":
        return this.parseChainOrPipe(t.pos);
      default:
        throw this.errAt(t, `expected command argument, found ${tokenLabel(t)}`, {
          expected: "command argument",
          found: tokenLabel(t),
        });
    }
  }

  private parseChainOrPipe(startPos: Pos): Node {
    const inner = this.parsePipeline();
    const rparen = this.expect("RightParen", "`)`");
    // Field chain on `(pipe).field` requires the `.` to be immediately
    // adjacent to `)` — otherwise it's a separate command argument.
    // The lexer's Field tokens carry source positions; if there was
    // whitespace between `)` and the next Field, their positions
    // won't be consecutive.
    const fields: string[] = [];
    const expectedNextOffset = rparen.pos.offset + 1;
    const t = this.peek();
    if (t.type === "Field" && t.pos.offset === expectedNextOffset) {
      this.next();
      fields.push(...t.value.slice(1).split("."));
    }
    if (fields.length === 0) return inner;
    return { type: "Chain", pos: startPos, node: inner, fields } satisfies ChainNode;
  }
}

// ---------------------------------------------------------------------------
// Helpers — pure data-in / data-out, no parser state.
// ---------------------------------------------------------------------------

function finishList(pos: Pos, nodes: Node[]): ListNode {
  return { type: "List", pos, nodes };
}

function trimFromToken(t: Token): TrimMarkers {
  return {
    trimLeft: t.trimLeft === true,
    trimRight: t.trimRight === true,
  };
}

function tokenLabel(t: Token): string {
  if (t.type === "EOF") return "end of input";
  return t.value || t.type;
}

function canStartPrimary(t: TokenType): boolean {
  switch (t) {
    case "Dot":
    case "Field":
    case "Variable":
    case "Identifier":
    case "String":
    case "Number":
    case "Char":
    case "Bool":
    case "Nil":
    case "LeftParen":
      return true;
    default:
      return false;
  }
}

function varFromToken(t: Token): VariableNode {
  return {
    type: "Variable",
    pos: t.pos,
    idents: splitVariableIdents(t.value),
  };
}

function splitVariableIdents(value: string): string[] {
  // `$name.x.y` → ["$name", "x", "y"]; `$` → ["$"]
  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return [value];
  return [value.slice(0, dotIdx), ...value.slice(dotIdx + 1).split(".")];
}

function numberFromToken(t: Token): NumberNode {
  const text = t.value;
  // Strip underscore separators per Go syntax.
  const cleaned = text.replace(/_/g, "");
  const lower = cleaned.toLowerCase();
  const isComplex = lower.endsWith("i");
  const body = isComplex ? cleaned.slice(0, -1) : cleaned;
  const isFloat =
    !isComplex &&
    (body.includes(".") ||
      (!body.startsWith("0x") && !body.startsWith("0X") && /[eE]/.test(body)) ||
      ((body.startsWith("0x") || body.startsWith("0X")) && /[pP]/.test(body)));
  const isInt = !isComplex && !isFloat;

  const base: NumberNode = {
    type: "Number",
    pos: t.pos,
    text,
    isInt,
    isUint: false,
    isFloat,
    isComplex,
  };

  if (isInt) {
    const intValue = parseIntegerLiteral(body);
    return { ...base, intValue };
  }
  if (isFloat) {
    const floatValue = parseFloatLiteral(body);
    return { ...base, floatValue };
  }
  // complex
  const im = parseFloatLiteral(body);
  return { ...base, complexValue: [0, im] };
}

function runeNumberFromToken(t: Token, source: string): NumberNode {
  const inner = decodeRuneLiteral(t.value, t.pos, source);
  return {
    type: "Number",
    pos: t.pos,
    text: t.value,
    isInt: true,
    isUint: false,
    isFloat: false,
    isComplex: false,
    intValue: BigInt(inner),
  };
}

function parseIntegerLiteral(text: string): bigint {
  // Handle leading sign explicitly because BigInt() accepts "+123" but
  // not all base-prefixed signed forms uniformly.
  let sign = 1n;
  let body = text;
  if (body.startsWith("+")) body = body.slice(1);
  else if (body.startsWith("-")) {
    sign = -1n;
    body = body.slice(1);
  }
  return sign * BigInt(body);
}

function parseFloatLiteral(text: string): number {
  return Number(text);
}

function decodeStringLiteral(raw: string, pos: Pos, source: string): string {
  if (raw.startsWith("`")) {
    return raw.slice(1, -1);
  }
  // Interpreted string: process escapes.
  let out = "";
  for (let i = 1; i < raw.length - 1; i++) {
    const c = raw[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "t":
        out += "\t";
        break;
      case "r":
        out += "\r";
        break;
      case "\\":
        out += "\\";
        break;
      case '"':
        out += '"';
        break;
      case "'":
        out += "'";
        break;
      case "a":
        out += "\x07";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "v":
        out += "\v";
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7": {
        // Octal — 3 digits total including the `next`.
        const digits = next + (raw[i + 1] ?? "") + (raw[i + 2] ?? "");
        i += 2;
        out += String.fromCodePoint(Number.parseInt(digits, 8));
        break;
      }
      case "x": {
        const digits = (raw[i + 1] ?? "") + (raw[i + 2] ?? "");
        i += 2;
        out += String.fromCodePoint(Number.parseInt(digits, 16));
        break;
      }
      case "u": {
        const digits = raw.slice(i + 1, i + 5);
        i += 4;
        out += String.fromCodePoint(Number.parseInt(digits, 16));
        break;
      }
      case "U": {
        const digits = raw.slice(i + 1, i + 9);
        i += 8;
        out += String.fromCodePoint(Number.parseInt(digits, 16));
        break;
      }
      default:
        throw new ParseError(`bad escape sequence \\${next}`, pos, {
          expected: "valid escape sequence",
          found: `\\${next}`,
          source,
        });
    }
  }
  return out;
}

function decodeRuneLiteral(raw: string, pos: Pos, source: string): number {
  // raw is `'x'` — slice the inner content and reuse the string decoder
  // by wrapping in double quotes (after escaping a literal `"`).
  const inner = raw.slice(1, -1);
  const escaped = inner.replace(/"/g, '\\"');
  const decoded = decodeStringLiteral(`"${escaped}"`, pos, source);
  if (decoded.length === 0) {
    throw new ParseError("empty rune literal", pos, { source });
  }
  return decoded.codePointAt(0) ?? 0;
}
