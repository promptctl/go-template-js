import { describe, expect, it } from "vitest";
import { ParseError } from "./errors.js";
import { parse } from "./parser.js";
import { pos } from "./pos.js";

describe("ParseError — fields", () => {
  it("exposes pos / expected / found / source", () => {
    const err = new ParseError("nope", pos(2, 3, 5), {
      expected: "}}",
      found: "EOF",
      source: "ok\n12345",
    });
    expect(err.pos).toEqual({ line: 2, column: 3, offset: 5 });
    expect(err.expected).toBe("}}");
    expect(err.found).toBe("EOF");
    expect(err.source).toBe("ok\n12345");
  });

  it("renders a snippet with line numbers and a caret on the error column", () => {
    const err = new ParseError("expected `}}`", pos(3, 7, 0), {
      source: "line 1\nline 2\nline 3 hi\nline 4",
    });
    const snippet = err.sourceSnippet;
    expect(snippet).toContain("2 | line 2");
    expect(snippet).toContain("3 | line 3 hi");
    expect(snippet).toContain("4 | line 4");
    // Caret aligned to column 7 (1-indexed) → 6 leading spaces after the gutter.
    const lines = snippet.split("\n");
    const caretLine = lines.find((l) => l.includes("^"));
    expect(caretLine).toBeDefined();
    expect(caretLine?.endsWith("      ^")).toBe(true);
  });

  it("toString() contains name, message, line/column, and snippet", () => {
    const err = new ParseError("expected `}}`", pos(2, 4, 0), {
      source: "abc\ndef",
    });
    const out = err.toString();
    expect(out).toMatch(/^ParseError: expected `\}\}`/);
    expect(out).toMatch(/at line 2, column 4/);
    expect(out).toContain("def");
    expect(out).toMatch(/\^/);
  });

  it("toString() degrades gracefully without source", () => {
    const err = new ParseError("nope", pos(1, 1, 0));
    expect(err.toString()).toBe("ParseError: nope\n  at line 1, column 1");
  });

  it("survives errors on the first or last line", () => {
    const first = new ParseError("e", pos(1, 1, 0), { source: "only" });
    expect(first.sourceSnippet).toContain("1 | only");
    const last = new ParseError("e", pos(2, 1, 0), { source: "a\nb" });
    expect(last.sourceSnippet).toContain("1 | a");
    expect(last.sourceSnippet).toContain("2 | b");
  });
});

describe("ParseError — curated scenarios from the parser", () => {
  it("flags an unclosed action with a helpful message", () => {
    let err: unknown;
    try {
      parse("hello {{ .x ");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/unclosed action/);
      expect(err.toString()).toContain("hello {{ .x");
    }
  });

  it("flags an unclosed control block (missing {{end}})", () => {
    let err: unknown;
    try {
      parse("{{ if .x }}body");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/missing `\{\{end\}\}`|expected `\{\{end\}\}`/);
    }
  });

  it("flags an unclosed comment", () => {
    expect(() => parse("{{/* nope")).toThrow(/unclosed comment/);
  });

  it("flags a stray {{else}} at top level", () => {
    let err: unknown;
    try {
      parse("hello {{else}}there");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/unexpected `\{\{else\}\}`|stray.*else|outside/);
    }
  });

  it("flags a stray {{end}} at top level", () => {
    let err: unknown;
    try {
      parse("hello {{end}}");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/unexpected `\{\{end\}\}`|stray.*end|outside/);
    }
  });

  it("flags a trailing `|` (missing command)", () => {
    let err: unknown;
    try {
      parse("{{ .x | }}");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/missing command|expected command/);
    }
  });

  it("flags a bad escape sequence", () => {
    let err: unknown;
    try {
      parse('{{ "\\q" }}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      expect(err.message).toMatch(/bad escape sequence \\q/);
    }
  });

  it("flags an unterminated string literal", () => {
    expect(() => parse('{{ "no end ')).toThrow(/unterminated string/);
  });

  it("flags an empty action", () => {
    expect(() => parse("{{}}")).toThrow(/empty action/);
  });

  it("error pos points at the failure site (not the start of source)", () => {
    let err: unknown;
    try {
      parse("hello\nworld {{ .x ");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ParseError);
    if (err instanceof ParseError) {
      // The unclosed-action error should be located on line 2 where the
      // action started (or where EOF was hit).
      expect(err.pos.line).toBeGreaterThanOrEqual(2);
    }
  });
});
