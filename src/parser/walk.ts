/**
 * AST traversal helpers.
 *
 * [LAW:dataflow-not-control-flow] `children()` is one exhaustive switch on
 * the node's `type` discriminator that always returns a (possibly empty)
 * array of children. Walkers do not skip operations — they always call
 * `visit(n)` on every reachable node, then recurse into whatever children
 * the data-driven `children()` exposes.
 *
 * [LAW:single-enforcer] All AST traversal goes through `walk` /
 * `children`. Any caller who reinvents traversal will diverge — fix the
 * helper, not the callsite.
 */

import { assertNever, type Node, type NodeType } from "./ast.js";

/**
 * Visitor callback. Receives every node in preorder. Return `false` to
 * stop descending into the current node's children; any other return
 * value (including `undefined`) means "continue".
 */
// biome-ignore lint/suspicious/noConfusingVoidType: void return is idiomatic for callback APIs where the caller may simply not return anything; switching to `undefined` would force every caller to write `return undefined` for no semantic gain.
export type Visitor = (node: Node) => boolean | void;

/**
 * Walk an AST in preorder. The visitor sees a node before its children.
 */
export function walk(node: Node, visit: Visitor): void {
  const descend = visit(node);
  if (descend === false) return;
  for (const child of children(node)) {
    walk(child, visit);
  }
}

/**
 * The direct children of a node, in source order. Empty for leaves.
 *
 * Returning a fresh array each call keeps the contract simple — callers
 * may iterate or splat without aliasing surprises. The cost is trivial
 * for AST traversal.
 */
export function children(node: Node): readonly Node[] {
  switch (node.type) {
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
    case "Break":
    case "Continue":
      return [];
    case "List":
      return node.nodes;
    case "Chain":
      return [node.node];
    case "Command":
      return node.args;
    case "Pipe":
      return [...node.decls, ...node.cmds];
    case "Action":
      return [node.pipe];
    case "If":
    case "Range":
    case "With":
      return node.elseList ? [node.pipe, node.list, node.elseList] : [node.pipe, node.list];
    case "Template":
      return node.pipe ? [node.pipe] : [];
    case "Block":
      return node.pipe ? [node.pipe, node.list] : [node.list];
    default:
      return assertNever(node);
  }
}

/**
 * Collect every node in preorder. Convenience for tests + tooling.
 */
export function flatten(node: Node): readonly Node[] {
  const out: Node[] = [];
  walk(node, (n) => {
    out.push(n);
  });
  return out;
}

/**
 * Count nodes of each kind. Useful for tests and diagnostics.
 */
export function tally(node: Node): Readonly<Record<NodeType, number>> {
  const counts = emptyTally();
  walk(node, (n) => {
    counts[n.type] += 1;
  });
  return counts;
}

function emptyTally(): Record<NodeType, number> {
  return {
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
    Break: 0,
    Continue: 0,
    Template: 0,
    Block: 0,
  };
}
