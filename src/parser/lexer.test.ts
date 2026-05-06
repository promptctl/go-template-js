import { describe, expect, it } from "vitest";
import { type Token, type TokenType, tokenize } from "./lexer.js";

const types = (toks: readonly Token[]): TokenType[] => toks.map((t) => t.type);
const values = (toks: readonly Token[]): string[] => toks.map((t) => t.value);

describe("tokenize — text and delimiters", () => {
  it("emits a single Text + EOF for plain source", () => {
    const toks = tokenize("hello world");
    expect(types(toks)).toEqual(["Text", "EOF"]);
    expect(values(toks)).toEqual(["hello world", ""]);
  });

  it("emits empty Text + EOF for empty source", () => {
    const toks = tokenize("");
    expect(types(toks)).toEqual(["EOF"]);
  });

  it("recognises a bare action {{ ident }}", () => {
    const toks = tokenize("{{ foo }}");
    expect(types(toks)).toEqual(["LeftDelim", "Identifier", "RightDelim", "EOF"]);
  });

  it("recognises adjacent text and action runs", () => {
    const toks = tokenize("hi {{ x }} bye");
    expect(types(toks)).toEqual(["Text", "LeftDelim", "Identifier", "RightDelim", "Text", "EOF"]);
    expect(values(toks)).toEqual(["hi ", "{{", "x", "}}", " bye", ""]);
  });
});

describe("tokenize — trim markers", () => {
  it("strips trailing whitespace before {{- and skips leading after", () => {
    const toks = tokenize("foo  \n  {{-  bar  -}}\n  baz");
    // Text "foo" (trailing whitespace stripped because of {{-),
    // LeftDelim "{{-", Identifier "bar", RightDelim "-}}",
    // Text "baz" (leading whitespace stripped because of -}})
    expect(types(toks)).toEqual(["Text", "LeftDelim", "Identifier", "RightDelim", "Text", "EOF"]);
    expect(values(toks)).toEqual(["foo", "{{-", "bar", "-}}", "baz", ""]);
    expect(toks[1]?.trimLeft).toBe(true);
    expect(toks[3]?.trimRight).toBe(true);
  });

  it("flags non-trim delimiters with neither flag set", () => {
    const toks = tokenize("{{ x }}");
    expect(toks[0]?.trimLeft).toBeUndefined();
    expect(toks[2]?.trimRight).toBeUndefined();
  });
});

describe("tokenize — comments", () => {
  it("captures a comment body without the surrounding delimiters", () => {
    const toks = tokenize("{{/* hello */}}");
    expect(types(toks)).toEqual(["Comment", "EOF"]);
    expect(toks[0]?.value).toBe("hello");
  });

  it("captures comments with trim markers", () => {
    const toks = tokenize("a {{- /* c */ -}} b");
    expect(types(toks)).toEqual(["Text", "Comment", "Text", "EOF"]);
    expect(values(toks).slice(0, 3)).toEqual(["a", "c", "b"]);
    expect(toks[1]?.trimLeft).toBe(true);
    expect(toks[1]?.trimRight).toBe(true);
  });

  it("rejects an unclosed comment", () => {
    expect(() => tokenize("{{/* nope")).toThrow(/unclosed comment/);
  });
});

describe("tokenize — identifiers, fields, variables", () => {
  it("recognises field chains", () => {
    const toks = tokenize("{{ .a.b.c }}");
    expect(types(toks)).toEqual(["LeftDelim", "Field", "RightDelim", "EOF"]);
    expect(toks[1]?.value).toBe(".a.b.c");
  });

  it("recognises a bare dot", () => {
    const toks = tokenize("{{ . }}");
    expect(types(toks)).toEqual(["LeftDelim", "Dot", "RightDelim", "EOF"]);
  });

  it("recognises a variable with field tail", () => {
    const toks = tokenize("{{ $x.a }}");
    expect(types(toks)).toEqual(["LeftDelim", "Variable", "RightDelim", "EOF"]);
    expect(toks[1]?.value).toBe("$x.a");
  });

  it("recognises bare $ as variable", () => {
    const toks = tokenize("{{ $ }}");
    expect(types(toks)).toEqual(["LeftDelim", "Variable", "RightDelim", "EOF"]);
    expect(toks[1]?.value).toBe("$");
  });

  it("keywords are emitted as their own token kinds", () => {
    const toks = tokenize(
      "{{ if }}{{ else }}{{ end }}{{ range }}{{ with }}{{ define }}{{ template }}{{ block }}",
    );
    const kinds = types(toks).filter((t) => !["LeftDelim", "RightDelim", "EOF"].includes(t));
    expect(kinds).toEqual(["If", "Else", "End", "Range", "With", "Define", "Template", "Block"]);
  });

  it("true / false / nil as their own kinds", () => {
    const toks = tokenize("{{ true }}{{ false }}{{ nil }}");
    expect(types(toks).filter((t) => !["LeftDelim", "RightDelim", "EOF"].includes(t))).toEqual([
      "Bool",
      "Bool",
      "Nil",
    ]);
  });
});

describe("tokenize — number literals", () => {
  it.each([
    ["{{ 0 }}", "0"],
    ["{{ 123 }}", "123"],
    ["{{ -42 }}", "-42"],
    ["{{ 0xff }}", "0xff"],
    ["{{ 0o17 }}", "0o17"],
    ["{{ 0b1010 }}", "0b1010"],
    ["{{ 1.5 }}", "1.5"],
    ["{{ .5 }}", ".5"],
    ["{{ 1e3 }}", "1e3"],
    ["{{ 1.5e-3 }}", "1.5e-3"],
    ["{{ 2i }}", "2i"],
  ])("%s → %s", (src, value) => {
    const toks = tokenize(src);
    const num = toks.find((t) => t.type === "Number");
    expect(num?.value).toBe(value);
  });
});

describe("tokenize — string literals", () => {
  it("interpreted strings preserve raw quotes and escapes", () => {
    const toks = tokenize('{{ "hi\\nthere" }}');
    const s = toks.find((t) => t.type === "String");
    expect(s?.value).toBe('"hi\\nthere"');
  });

  it("raw strings can span newlines", () => {
    const toks = tokenize("{{ `line1\nline2` }}");
    const s = toks.find((t) => t.type === "String");
    expect(s?.value).toBe("`line1\nline2`");
  });

  it("strings can contain what looks like a delimiter", () => {
    const toks = tokenize('{{ "}}" }}');
    const s = toks.find((t) => t.type === "String");
    expect(s?.value).toBe('"}}"');
    // Final RightDelim still emitted normally.
    expect(toks[toks.length - 2]?.type).toBe("RightDelim");
  });

  it("rejects unterminated interpreted string", () => {
    expect(() => tokenize('{{ "no end ')).toThrow(/unterminated string/);
  });

  it("rejects newline inside interpreted string", () => {
    expect(() => tokenize('{{ "no\n')).toThrow(/newline in interpreted string/);
  });
});

describe("tokenize — char (rune) literals", () => {
  it("captures a single-quoted rune", () => {
    const toks = tokenize("{{ 'x' }}");
    const c = toks.find((t) => t.type === "Char");
    expect(c?.value).toBe("'x'");
  });

  it("captures escaped runes", () => {
    const toks = tokenize("{{ '\\n' }}");
    const c = toks.find((t) => t.type === "Char");
    expect(c?.value).toBe("'\\n'");
  });

  it("rejects unterminated rune literal", () => {
    expect(() => tokenize("{{ 'x ")).toThrow(/unterminated rune/);
  });
});

describe("tokenize — operators and punctuation", () => {
  it("recognises pipe, parens, comma, := and =", () => {
    const toks = tokenize("{{ $x, $y := f a | g }}");
    const punct = toks
      .map((t) => t.type)
      .filter((t) =>
        [
          "Variable",
          "Comma",
          "Declare",
          "Assign",
          "Pipe",
          "LeftParen",
          "RightParen",
          "Identifier",
        ].includes(t),
      );
    expect(punct).toEqual([
      "Variable",
      "Comma",
      "Variable",
      "Declare",
      "Identifier",
      "Identifier",
      "Pipe",
      "Identifier",
    ]);
  });
});

describe("tokenize — positions", () => {
  it("tracks line and column across newlines", () => {
    const src = "a\nbb\n{{ x }}";
    const toks = tokenize(src);
    const x = toks.find((t) => t.type === "Identifier" && t.value === "x");
    expect(x?.pos.line).toBe(3);
    expect(x?.pos.column).toBe(4); // "{{ " = 3 chars, x at col 4
    expect(x?.pos.offset).toBe(8); // "a\nbb\n{{ " = 8 chars
  });
});
