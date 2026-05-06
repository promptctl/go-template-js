import { describe, expect, it } from "vitest";
import type { ActionNode, IfNode, ListNode, Node, NodeType, PipeNode } from "./ast.js";
import { NO_TRIM } from "./ast.js";
import { pos } from "./pos.js";
import { children, flatten, tally, walk } from "./walk.js";

const P = pos(1, 1, 0);

const sampleTree = (): ListNode => {
  const pipe: PipeNode = {
    type: "Pipe",
    pos: P,
    decls: [],
    isAssign: false,
    cmds: [
      {
        type: "Command",
        pos: P,
        args: [
          { type: "Identifier", pos: P, ident: "eq" },
          { type: "Field", pos: P, idents: ["x"] },
          {
            type: "Number",
            pos: P,
            text: "1",
            isInt: true,
            isUint: false,
            isFloat: false,
            isComplex: false,
            intValue: 1n,
          },
        ],
      },
    ],
  };

  const ifAction: IfNode = {
    type: "If",
    pos: P,
    pipe,
    list: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "yes" }] },
    elseList: { type: "List", pos: P, nodes: [{ type: "Text", pos: P, text: "no" }] },
    trim: NO_TRIM,
  };

  const action: ActionNode = {
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
  };

  return {
    type: "List",
    pos: P,
    nodes: [{ type: "Text", pos: P, text: "hello " }, ifAction, action],
  };
};

describe("walk", () => {
  it("visits every reachable node in preorder", () => {
    const root = sampleTree();
    const types: NodeType[] = [];
    walk(root, (n) => {
      types.push(n.type);
    });
    expect(types[0]).toBe("List");
    expect(types).toMatchSnapshot();
  });

  it("respects a `false` return to halt descent into the current subtree", () => {
    // Halting at If must not block the sibling Action; only the If's
    // own children are skipped.
    const root = sampleTree();
    const fullCount = tally(root);

    const seen: NodeType[] = [];
    walk(root, (n) => {
      seen.push(n.type);
      if (n.type === "If") return false;
    });

    const halted: Record<NodeType, number> = {
      Text: 0,
      Comment: 0,
      Dot: 0,
      Nil: 0,
      Bool: 0,
      Number: 0,
      String: 0,
      Identifier: 0,
      Field: 0,
      Variable: 0,
      List: 0,
      Chain: 0,
      Command: 0,
      Pipe: 0,
      Action: 0,
      If: 0,
      Range: 0,
      With: 0,
      Template: 0,
      Block: 0,
    };
    for (const t of seen) halted[t] += 1;

    // The If is visited but its Pipe (a child only of the If) is not.
    expect(halted.If).toBe(1);
    expect(halted.Pipe).toBe(fullCount.Pipe - 1);
    // The IfNode's `eq .x 1` Command is unique to it — must not appear.
    expect(halted.Command).toBe(fullCount.Command - 1);
    // Sibling Action's Dot is still reachable.
    expect(halted.Dot).toBe(1);
  });

  it("`flatten` produces the same order as a manual walk", () => {
    const root = sampleTree();
    const manual: NodeType[] = [];
    walk(root, (n) => {
      manual.push(n.type);
    });
    expect(flatten(root).map((n) => n.type)).toEqual(manual);
  });

  it("`tally` counts every node kind exactly once per occurrence", () => {
    const root = sampleTree();
    const counts = tally(root);
    expect(counts.List).toBeGreaterThanOrEqual(3);
    expect(counts.If).toBe(1);
    expect(counts.Action).toBe(1);
    expect(counts.Dot).toBe(1);
    expect(counts.Identifier).toBe(1);
    expect(counts.Number).toBe(1);
    expect(counts.Pipe).toBe(2);
  });
});

describe("children", () => {
  it("returns [] for every leaf", () => {
    const leaves: Node[] = [
      { type: "Text", pos: P, text: "x" },
      { type: "Comment", pos: P, text: " c ", trim: NO_TRIM },
      { type: "Dot", pos: P },
      { type: "Nil", pos: P },
      { type: "Bool", pos: P, value: true },
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
      { type: "String", pos: P, raw: '""', value: "" },
      { type: "Identifier", pos: P, ident: "foo" },
      { type: "Field", pos: P, idents: ["a"] },
      { type: "Variable", pos: P, idents: ["$x"] },
    ];
    for (const leaf of leaves) {
      expect(children(leaf)).toEqual([]);
    }
  });

  it("treats an If without elseList as having two children, with elseList as three", () => {
    const root = sampleTree();
    const withElse = root.nodes[1] as IfNode;
    expect(children(withElse)).toHaveLength(3);

    const withoutElse: IfNode = { ...withElse };
    delete (withoutElse as { elseList?: ListNode }).elseList;
    expect(children(withoutElse)).toHaveLength(2);
  });
});
