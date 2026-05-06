import { describe, expect, it } from "vitest";
import type {
  ActionNode,
  BlockNode,
  ChainNode,
  IfNode,
  ListNode,
  PipeNode,
  RangeNode,
  TemplateNode,
  WithNode,
} from "./ast.js";
import { NO_TRIM } from "./ast.js";
import { pos } from "./pos.js";
import { stringify } from "./stringify.js";

const P = pos(1, 1, 0);

describe("stringify", () => {
  it("renders plain text verbatim", () => {
    expect(stringify({ type: "Text", pos: P, text: "hello" })).toBe("hello");
  });

  it("renders a comment with surrounding action delimiters", () => {
    expect(stringify({ type: "Comment", pos: P, text: "hi", trim: NO_TRIM })).toBe(
      "{{ /* hi */ }}",
    );
  });

  it("renders a comment with trim markers", () => {
    expect(
      stringify({
        type: "Comment",
        pos: P,
        text: "hi",
        trim: { trimLeft: true, trimRight: true },
      }),
    ).toBe("{{- /* hi */ -}}");
  });

  it("renders simple action with field access", () => {
    const action: ActionNode = {
      type: "Action",
      pos: P,
      trim: NO_TRIM,
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Field", pos: P, idents: ["name"] }] }],
      },
    };
    expect(stringify(action)).toBe("{{ .name }}");
  });

  it("renders a pipeline with `:=` declaration", () => {
    const pipe: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [{ type: "Variable", pos: P, idents: ["$x"] }],
      isAssign: false,
      cmds: [
        {
          type: "Command",
          pos: P,
          args: [
            { type: "Identifier", pos: P, ident: "upper" },
            { type: "Field", pos: P, idents: ["name"] },
          ],
        },
      ],
    };
    expect(stringify(pipe)).toBe("$x := upper .name");
  });

  it("renders a pipeline with `=` reassignment", () => {
    const pipe: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [{ type: "Variable", pos: P, idents: ["$x"] }],
      isAssign: true,
      cmds: [
        {
          type: "Command",
          pos: P,
          args: [
            {
              type: "Number",
              pos: P,
              text: "0",
              isInt: true,
              isUint: false,
              isFloat: false,
              isComplex: false,
              intValue: 0n,
            },
          ],
        },
      ],
    };
    expect(stringify(pipe)).toBe("$x = 0");
  });

  it("renders chained commands joined by `|`", () => {
    const pipe: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [],
      isAssign: false,
      cmds: [
        { type: "Command", pos: P, args: [{ type: "Identifier", pos: P, ident: "lower" }] },
        { type: "Command", pos: P, args: [{ type: "Identifier", pos: P, ident: "trim" }] },
      ],
    };
    expect(stringify(pipe)).toBe("lower | trim");
  });

  it("renders a chain with parens", () => {
    const inner: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [],
      isAssign: false,
      cmds: [
        {
          type: "Command",
          pos: P,
          args: [{ type: "Identifier", pos: P, ident: "make" }],
        },
      ],
    };
    const chain: ChainNode = {
      type: "Chain",
      pos: P,
      node: inner,
      fields: ["x", "y"],
    };
    expect(stringify(chain)).toBe("(make).x.y");
  });

  it("renders if/else/end with trim markers on the outer braces only", () => {
    const branch: IfNode = {
      type: "If",
      pos: P,
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Field", pos: P, idents: ["ok"] }] }],
      },
      list: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "yes" }] },
      elseList: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "no" }] },
      trim: { trimLeft: true, trimRight: true },
    };
    expect(stringify(branch)).toBe("{{- if .ok }}yes{{ else }}no{{ end -}}");
  });

  it("renders range without an else clause", () => {
    const node: RangeNode = {
      type: "Range",
      pos: P,
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [{ type: "Variable", pos: P, idents: ["$i"] }],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Field", pos: P, idents: ["items"] }] }],
      },
      list: {
        type: "List",
        pos: P,
        nodes: [{ type: "Text", pos: P, text: "*" }],
      },
      trim: NO_TRIM,
    };
    expect(stringify(node)).toBe("{{ range $i := .items }}*{{ end }}");
  });

  it("renders with/end", () => {
    const node: WithNode = {
      type: "With",
      pos: P,
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Field", pos: P, idents: ["opt"] }] }],
      },
      list: {
        type: "List",
        pos: P,
        nodes: [
          {
            type: "Action",
            pos: P,
            trim: NO_TRIM,
            pipe: {
              type: "Pipe",
              pos: P,
              decls: [],
              isAssign: false,
              cmds: [{ type: "Command", pos: P, args: [{ type: "Dot", pos: P }] }],
            },
          },
        ],
      },
      trim: NO_TRIM,
    };
    expect(stringify(node)).toBe("{{ with .opt }}{{ . }}{{ end }}");
  });

  it("renders a template invocation", () => {
    const node: TemplateNode = {
      type: "Template",
      pos: P,
      name: "footer",
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Dot", pos: P }] }],
      },
      trim: NO_TRIM,
    };
    expect(stringify(node)).toBe('{{ template "footer" . }}');
  });

  it("renders a block definition + invocation", () => {
    const node: BlockNode = {
      type: "Block",
      pos: P,
      name: "hdr",
      pipe: {
        type: "Pipe",
        pos: P,
        decls: [],
        isAssign: false,
        cmds: [{ type: "Command", pos: P, args: [{ type: "Dot", pos: P }] }],
      },
      list: {
        type: "List",
        pos: P,
        nodes: [{ type: "Text", pos: P, text: "H" }],
      },
      trim: NO_TRIM,
    };
    expect(stringify(node)).toBe('{{ block "hdr" . }}H{{ end }}');
  });

  it("renders a complete list of mixed nodes", () => {
    const root: ListNode = {
      type: "List",
      pos: P,
      nodes: [
        { type: "Text", pos: P, text: "Hello, " },
        {
          type: "Action",
          pos: P,
          trim: NO_TRIM,
          pipe: {
            type: "Pipe",
            pos: P,
            decls: [],
            isAssign: false,
            cmds: [
              {
                type: "Command",
                pos: P,
                args: [{ type: "Field", pos: P, idents: ["name"] }],
              },
            ],
          },
        },
        { type: "Text", pos: P, text: "!" },
      ],
    };
    expect(stringify(root)).toBe("Hello, {{ .name }}!");
  });
});
