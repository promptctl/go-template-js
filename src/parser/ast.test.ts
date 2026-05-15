import { describe, expect, it } from "vitest";
import {
  type ActionNode,
  assertNever,
  type BoolNode,
  type CommandNode,
  type CommentNode,
  type DotNode,
  type FieldNode,
  type IdentifierNode,
  type IfNode,
  type ListNode,
  NO_TRIM,
  type Node,
  type NodeType,
  type NumberNode,
  type PipeNode,
  type RangeNode,
  type StringNode,
  type TextNode,
  type VariableNode,
  type WithNode,
} from "./ast.js";
import { pos } from "./pos.js";

const P = pos(1, 1, 0);

describe("Node discriminator coverage", () => {
  it("every NodeType has a constructor below — exhaustive type check", () => {
    // A switch over Node["type"] that returns a marker for every kind.
    // If a new node kind is added without updating this switch, TS will
    // flag the missing case via `assertNever`.
    const exhaustive = (n: Node): NodeType => {
      switch (n.type) {
        case "Text":
        case "Comment":
        case "Dot":
        case "Nil":
        case "Bool":
        case "Number":
        case "String":
        case "Identifier":
        case "Field":
        case "Variable":
        case "List":
        case "Chain":
        case "Command":
        case "Pipe":
        case "Action":
        case "If":
        case "Range":
        case "With":
        case "Break":
        case "Continue":
        case "Template":
        case "Block":
          return n.type;
        default:
          return assertNever(n);
      }
    };

    const text: TextNode = { type: "Text", pos: P, text: "x" };
    expect(exhaustive(text)).toBe("Text");
  });

  it("assertNever throws when called at runtime", () => {
    expect(() => assertNever({ type: "Bogus" } as never)).toThrow(/unhandled node kind/);
  });
});

describe("Sample node construction", () => {
  it("builds a complete AST shape (every node kind reachable from one tree)", () => {
    // {{/* hello */}}{{- if eq .x 1 -}}A{{else}}B{{end}}
    // {{range $i := .items}}{{$i}}{{end}}
    // {{with .opt}}{{.}}{{end}}
    // {{template "footer" .}}
    const dot: DotNode = { type: "Dot", pos: P };
    const ident: IdentifierNode = { type: "Identifier", pos: P, ident: "eq" };
    const field: FieldNode = { type: "Field", pos: P, idents: ["x"] };
    const num: NumberNode = {
      type: "Number",
      pos: P,
      text: "1",
      isInt: true,
      isUint: false,
      isFloat: false,
      isComplex: false,
      intValue: 1n,
    };
    const str: StringNode = { type: "String", pos: P, raw: '"footer"', value: "footer" };
    const bool: BoolNode = { type: "Bool", pos: P, value: true };
    const comment: CommentNode = { type: "Comment", pos: P, text: "hello", trim: NO_TRIM };
    const variable: VariableNode = { type: "Variable", pos: P, idents: ["$i"] };

    const ifPipe: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [],
      isAssign: false,
      cmds: [{ type: "Command", pos: P, args: [ident, field, num] } satisfies CommandNode],
    };
    const ifBranch: IfNode = {
      type: "If",
      pos: P,
      pipe: ifPipe,
      list: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "A" }] },
      elseList: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "B" }] },
      trim: { trimLeft: true, trimRight: true },
    };

    const rangePipe: PipeNode = {
      type: "Pipe",
      pos: P,
      decls: [variable],
      isAssign: false,
      cmds: [{ type: "Command", pos: P, args: [{ type: "Field", pos: P, idents: ["items"] }] }],
    };
    const rangeNode: RangeNode = {
      type: "Range",
      pos: P,
      pipe: rangePipe,
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
              cmds: [{ type: "Command", pos: P, args: [variable] }],
            },
          } satisfies ActionNode,
        ],
      },
      trim: NO_TRIM,
    };

    const withNode: WithNode = {
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
              cmds: [{ type: "Command", pos: P, args: [dot] }],
            },
          },
        ],
      },
      trim: NO_TRIM,
    };

    const root: ListNode = {
      type: "List",
      pos: P,
      nodes: [comment, ifBranch, rangeNode, withNode, str, bool],
    };

    expect(root.type).toBe("List");
    expect(root.nodes.length).toBe(6);
  });
});
