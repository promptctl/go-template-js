import { describe, expect, it } from "vitest";
import type { Node, NodeType } from "./ast.js";
import { parse } from "./parser.js";
import { stringify } from "./stringify.js";

// Local narrowing helper — `noUncheckedIndexedAccess` makes
// `root.nodes[0]` return `Node | undefined`, so every assertion would
// otherwise need its own `?.` dance. This keeps the tests readable.
function assertNode<K extends NodeType>(
  node: Node | undefined,
  kind: K,
): asserts node is Extract<Node, { type: K }> {
  if (node?.type !== kind) {
    throw new Error(`expected ${kind}, got ${node?.type ?? "undefined"}`);
  }
}

describe("parse — text and simple actions", () => {
  it("parses plain text into a single TextNode", () => {
    const { root } = parse("hello world");
    expect(root.nodes).toHaveLength(1);
    expect(root.nodes[0]).toMatchObject({ type: "Text", text: "hello world" });
  });

  it("parses {{ . }} into an Action containing a Pipe with a single Dot command", () => {
    const { root } = parse("{{ . }}");
    expect(root.nodes).toHaveLength(1);
    expect(root.nodes[0]).toMatchObject({
      type: "Action",
      pipe: {
        type: "Pipe",
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", args: [{ type: "Dot" }] }],
      },
    });
  });

  it("parses field-access actions", () => {
    const { root } = parse("{{ .foo.bar }}");
    expect(root.nodes[0]).toMatchObject({
      type: "Action",
      pipe: {
        cmds: [{ args: [{ type: "Field", idents: ["foo", "bar"] }] }],
      },
    });
  });

  it("parses identifier with arguments", () => {
    const { root } = parse('{{ printf "%d" 42 }}');
    expect(root.nodes[0]).toMatchObject({
      type: "Action",
      pipe: {
        cmds: [
          {
            args: [
              { type: "Identifier", ident: "printf" },
              { type: "String", value: "%d" },
              { type: "Number", isInt: true, intValue: 42n },
            ],
          },
        ],
      },
    });
  });
});

describe("parse — pipelines and declarations", () => {
  it("parses chained pipes", () => {
    const { root } = parse("{{ .x | upper | trim }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    expect(action.pipe.cmds).toHaveLength(3);
    expect(action.pipe.cmds[0]?.args[0]).toMatchObject({ type: "Field" });
    expect(action.pipe.cmds[1]?.args[0]).toMatchObject({ type: "Identifier", ident: "upper" });
    expect(action.pipe.cmds[2]?.args[0]).toMatchObject({ type: "Identifier", ident: "trim" });
  });

  it("parses :=  declaration", () => {
    const { root } = parse("{{ $x := .y }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    expect(action.pipe.decls).toHaveLength(1);
    expect(action.pipe.decls[0]?.idents).toEqual(["$x"]);
    expect(action.pipe.isAssign).toBe(false);
  });

  it("parses = reassignment", () => {
    const { root } = parse("{{ $x = 0 }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    expect(action.pipe.isAssign).toBe(true);
  });

  it("parses multi-variable range declaration", () => {
    const { root } = parse("{{range $i, $v := .items}}{{ $v }}{{end}}");
    const range = root.nodes[0];
    assertNode(range, "Range");
    expect(range.pipe.decls).toHaveLength(2);
    expect(range.pipe.decls[0]?.idents).toEqual(["$i"]);
    expect(range.pipe.decls[1]?.idents).toEqual(["$v"]);
  });

  it("parses parenthesized pipeline as primary", () => {
    const { root } = parse('{{ (printf "%d" 1) }}');
    const action = root.nodes[0];
    assertNode(action, "Action");
    const arg = action.pipe.cmds[0]?.args[0];
    expect(arg?.type).toBe("Pipe"); // bare paren without trailing field returns the inner pipe
  });

  it("parses (pipe).field as a Chain", () => {
    const { root } = parse("{{ (.x).y }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    const arg = action.pipe.cmds[0]?.args[0];
    expect(arg).toMatchObject({ type: "Chain", fields: ["y"] });
  });
});

describe("parse — control flow", () => {
  it("parses if/end", () => {
    const { root } = parse("{{ if .ok }}yes{{ end }}");
    const branch = root.nodes[0];
    assertNode(branch, "If");
    expect(branch.list.nodes).toEqual([expect.objectContaining({ type: "Text", text: "yes" })]);
    expect(branch.elseList).toBeUndefined();
  });

  it("parses if/else/end", () => {
    const { root } = parse("{{ if .ok }}yes{{ else }}no{{ end }}");
    const branch = root.nodes[0];
    assertNode(branch, "If");
    expect(branch.elseList?.nodes[0]).toMatchObject({ type: "Text", text: "no" });
  });

  it("desugars else if into nested IfNodes", () => {
    const { root } = parse("{{ if .a }}A{{ else if .b }}B{{ else }}C{{ end }}");
    const outer = root.nodes[0];
    assertNode(outer, "If");
    expect(outer.elseList?.nodes).toHaveLength(1);
    const inner = outer.elseList?.nodes[0];
    expect(inner?.type).toBe("If");
    if (inner?.type !== "If") return;
    expect(inner.list.nodes[0]).toMatchObject({ type: "Text", text: "B" });
    expect(inner.elseList?.nodes[0]).toMatchObject({ type: "Text", text: "C" });
  });

  it("parses range/end with else", () => {
    const { root } = parse("{{ range .items }}*{{ else }}none{{ end }}");
    const r = root.nodes[0];
    assertNode(r, "Range");
    expect(r.elseList?.nodes[0]).toMatchObject({ type: "Text", text: "none" });
  });

  it("parses with/end", () => {
    const { root } = parse("{{ with .opt }}{{ . }}{{ end }}");
    expect(root.nodes[0]?.type).toBe("With");
  });

  it("parses {{break}} as a leaf inside a range body", () => {
    const { root } = parse("{{ range .items }}{{ break }}{{ end }}");
    const r = root.nodes[0];
    assertNode(r, "Range");
    expect(r.list.nodes[0]).toMatchObject({ type: "Break" });
  });

  it("parses {{continue}} as a leaf inside a range body", () => {
    const { root } = parse("{{ range .items }}{{ continue }}{{ end }}");
    const r = root.nodes[0];
    assertNode(r, "Range");
    expect(r.list.nodes[0]).toMatchObject({ type: "Continue" });
  });

  it("preserves trim markers on {{- break -}}", () => {
    const { root } = parse("{{ range .items }}{{- break -}}{{ end }}");
    const r = root.nodes[0];
    assertNode(r, "Range");
    const b = r.list.nodes[0];
    assertNode(b, "Break");
    expect(b.trim).toEqual({ trimLeft: true, trimRight: true });
  });
});

describe("parse — sub-templates", () => {
  it('parses {{template "name"}} without args', () => {
    const { root } = parse('{{ template "footer" }}');
    expect(root.nodes[0]).toMatchObject({ type: "Template", name: "footer" });
  });

  it('parses {{template "name" .}} with pipeline', () => {
    const { root } = parse('{{ template "footer" . }}');
    const t = root.nodes[0];
    if (t?.type !== "Template") throw new Error("expected Template");
    expect(t.pipe?.cmds[0]?.args[0]?.type).toBe("Dot");
  });

  it("captures {{define}} blocks into the defines map", () => {
    const { root, defines } = parse('{{define "hdr"}}H{{end}}main');
    expect(root.nodes).toEqual([expect.objectContaining({ type: "Text", text: "main" })]);
    expect(defines.has("hdr")).toBe(true);
    expect(defines.get("hdr")?.nodes[0]).toMatchObject({ type: "Text", text: "H" });
  });

  it("parses {{block}} which both defines and invokes", () => {
    const { root, defines } = parse('{{block "hdr" .}}H{{end}}');
    const b = root.nodes[0];
    expect(b?.type).toBe("Block");
    expect(defines.get("hdr")?.nodes[0]).toMatchObject({ type: "Text", text: "H" });
  });
});

describe("parse — comments and trim markers", () => {
  it("preserves comments as nodes", () => {
    const { root } = parse("a{{/* note */}}b");
    expect(root.nodes.map((n) => n.type)).toEqual(["Text", "Comment", "Text"]);
  });

  it("strips trailing whitespace before {{- and leading after -}}", () => {
    const { root } = parse("foo  \n  {{- .x -}}\n  baz");
    const texts = root.nodes.filter((n) => n.type === "Text");
    expect(texts.map((n) => (n.type === "Text" ? n.text : ""))).toEqual(["foo", "baz"]);
  });

  it("preserves trim flags on Action and Comment nodes", () => {
    const { root } = parse("{{- .x -}}");
    const action = root.nodes[0];
    expect(action?.type).toBe("Action");
    if (action?.type !== "Action") return;
    expect(action.trim).toEqual({ trimLeft: true, trimRight: true });
  });
});

describe("parse — literals", () => {
  it.each([
    ["{{ 0xff }}", 255n],
    ["{{ 0o17 }}", 15n],
    ["{{ 0b1010 }}", 10n],
    ["{{ -42 }}", -42n],
  ])("parses integer literal %s = %s", (src, expected) => {
    const { root } = parse(src);
    const action = root.nodes[0];
    assertNode(action, "Action");
    const num = action.pipe.cmds[0]?.args[0];
    if (num?.type !== "Number") throw new Error("expected Number");
    expect(num.intValue).toBe(expected);
  });

  it("parses float literals", () => {
    const { root } = parse("{{ 1.5e2 }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    const num = action.pipe.cmds[0]?.args[0];
    if (num?.type !== "Number") throw new Error("expected Number");
    expect(num.isFloat).toBe(true);
    expect(num.floatValue).toBe(150);
  });

  it("decodes string escapes", () => {
    const { root } = parse('{{ "a\\nb\\tc" }}');
    const action = root.nodes[0];
    assertNode(action, "Action");
    const s = action.pipe.cmds[0]?.args[0];
    if (s?.type !== "String") throw new Error("expected String");
    expect(s.value).toBe("a\nb\tc");
  });

  it("preserves raw string content verbatim", () => {
    const { root } = parse("{{ `line1\nline2` }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    const s = action.pipe.cmds[0]?.args[0];
    if (s?.type !== "String") throw new Error("expected String");
    expect(s.value).toBe("line1\nline2");
  });

  it("parses rune literals as Numbers via codepoint", () => {
    const { root } = parse("{{ 'x' }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    const c = action.pipe.cmds[0]?.args[0];
    if (c?.type !== "Number") throw new Error("expected Number");
    expect(c.intValue).toBe(BigInt("x".codePointAt(0) ?? 0));
  });
});

describe("parse — edge cases from ticket", () => {
  it("strings containing }} do not confuse the lexer", () => {
    const { root } = parse('{{ "}}" }}');
    const action = root.nodes[0];
    assertNode(action, "Action");
    const s = action.pipe.cmds[0]?.args[0];
    expect(s?.type).toBe("String");
  });

  it("backtick strings span newlines", () => {
    const { root } = parse("{{ `a\nb\nc` }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    const s = action.pipe.cmds[0]?.args[0];
    if (s?.type !== "String") throw new Error("expected String");
    expect(s.value).toBe("a\nb\nc");
  });

  it("deeply nested pipelines don't lose structure", () => {
    const { root } = parse("{{ a (b (c .x)) }}");
    const action = root.nodes[0];
    assertNode(action, "Action");
    expect(action.pipe.cmds[0]?.args).toHaveLength(2);
    expect(action.pipe.cmds[0]?.args[1]?.type).toBe("Pipe"); // (b (c .x)) is a parenthesised pipe
  });

  it("comment containing what looks like an action", () => {
    const { root } = parse("{{/* {{not an action}} */}}");
    expect(root.nodes[0]).toMatchObject({ type: "Comment" });
  });
});

describe("parse — round-trip via stringify", () => {
  it.each([
    "Hello, {{ .name }}!",
    "{{ if .ok }}yes{{ else }}no{{ end }}",
    "{{ range $i := .items }}*{{ end }}",
    "{{ range .items }}{{ break }}{{ end }}",
    "{{ range .items }}{{ continue }}{{ end }}",
    '{{ template "footer" . }}',
    "{{ .x | upper | trim }}",
  ])("round-trips %s", (src) => {
    const { root } = parse(src);
    const round = stringify(root);
    // Re-parse the round-tripped output; the resulting AST should
    // match the original structurally (we compare a stringify of both,
    // since canonicalisation may have normalised whitespace).
    const reparsed = parse(round);
    expect(stringify(reparsed.root)).toBe(round);
  });
});

describe("parse — error cases", () => {
  it("rejects unclosed action", () => {
    expect(() => parse("{{ .x ")).toThrow();
  });

  it("rejects unclosed branch", () => {
    expect(() => parse("{{ if .x }}")).toThrow();
  });

  it("rejects empty action", () => {
    expect(() => parse("{{ }}")).toThrow(/empty action/);
  });

  it("rejects redefinition of a template", () => {
    expect(() => parse('{{define "x"}}A{{end}}{{define "x"}}B{{end}}')).toThrow(/redefinition/);
  });

  it("rejects {{break}} outside any range", () => {
    expect(() => parse("{{ break }}")).toThrow(/\{\{break\}\} outside of \{\{range\}\}/);
  });

  it("rejects {{continue}} outside any range", () => {
    expect(() => parse("{{ continue }}")).toThrow(/\{\{continue\}\} outside of \{\{range\}\}/);
  });

  it("rejects {{break}} inside a define even if the define is nested in a range", () => {
    expect(() => parse('{{ range . }}{{ define "x" }}{{ break }}{{ end }}{{ end }}')).toThrow(
      /\{\{break\}\} outside of \{\{range\}\}/,
    );
  });
});
