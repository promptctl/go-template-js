/**
 * Pretty-print an AST back to template source.
 *
 * [LAW:dataflow-not-control-flow] One exhaustive switch on the node type.
 * Surface variability lives in the discriminator and trim flags, not in
 * skipped operations.
 *
 * Round-trip discipline: the output should re-parse to a structurally
 * identical AST for any AST the parser produces. We do not promise
 * byte-for-byte identity with arbitrary user source — interior whitespace
 * inside `{{ ... }}`, redundant parentheses, and string-quote style are
 * normalized.
 */

import {
  type ActionNode,
  assertNever,
  type BlockNode,
  type ChainNode,
  type CommandNode,
  type IfNode,
  type Node,
  type PipeNode,
  type RangeNode,
  type TemplateNode,
  type TrimMarkers,
  type WithNode,
} from "./ast.js";

export function stringify(node: Node): string {
  switch (node.type) {
    case "Text":
      return node.text;
    case "Comment": {
      const [left, right] = delims(node.trim);
      return `${left}/* ${node.text} */${right}`;
    }
    case "Dot":
      return ".";
    case "Nil":
      return "nil";
    case "Bool":
      return node.value ? "true" : "false";
    case "Number":
      return node.text;
    case "String":
      return node.raw;
    case "Identifier":
      return node.ident;
    case "Field":
      return node.idents.map((id) => `.${id}`).join("");
    case "Variable":
      return formatVariable(node.idents);
    case "List":
      return node.nodes.map(stringify).join("");
    case "Chain":
      return formatChain(node);
    case "Command":
      return formatCommand(node);
    case "Pipe":
      return formatPipe(node);
    case "Action":
      return formatAction(node);
    case "If":
      return formatBranch("if", node);
    case "Range":
      return formatBranch("range", node);
    case "With":
      return formatBranch("with", node);
    case "Break":
      return wrapAction("break", node.trim);
    case "Continue":
      return wrapAction("continue", node.trim);
    case "Template":
      return formatTemplate(node);
    case "Block":
      return formatBlock(node);
    default:
      return assertNever(node);
  }
}

// ---------------------------------------------------------------------------
// Action delimiter formatting.
//
// Go's spec requires a space between `{{-` / `-}}` and adjacent content.
// Without trim, the canonical form puts a single space inside the braces.
// ---------------------------------------------------------------------------

function delims(trim: TrimMarkers): readonly [string, string] {
  return [trim.trimLeft ? "{{- " : "{{ ", trim.trimRight ? " -}}" : " }}"];
}

function wrapAction(body: string, trim: TrimMarkers): string {
  const [left, right] = delims(trim);
  return `${left}${body}${right}`;
}

// ---------------------------------------------------------------------------
// Per-shape formatters — each is data-in / string-out, side-effect free.
// ---------------------------------------------------------------------------

function formatVariable(idents: readonly string[]): string {
  // [LAW:no-defensive-null-guards] The parser's `splitVariableIdents`
  // always emits at least one element (the leading "$name" head). An
  // empty `idents` is an internal invariant break, not a render-time
  // input — fail loudly instead of patching it with a `"$"` placeholder
  // that would mask the parser bug.
  const [head, ...rest] = idents;
  if (head === undefined) {
    throw new Error("internal: VariableNode has empty idents — parser invariant violated");
  }
  return rest.length === 0 ? head : `${head}${rest.map((f) => `.${f}`).join("")}`;
}

function formatChain(node: ChainNode): string {
  const inner = stringify(node.node);
  const tail = node.fields.map((f) => `.${f}`).join("");
  return `(${inner})${tail}`;
}

function formatCommand(node: CommandNode): string {
  return node.args.map(stringify).join(" ");
}

function formatPipe(node: PipeNode): string {
  const decl =
    node.decls.length === 0
      ? ""
      : `${node.decls.map(stringify).join(", ")} ${node.isAssign ? "=" : ":="} `;
  const cmds = node.cmds.map(stringify).join(" | ");
  return `${decl}${cmds}`;
}

function formatAction(node: ActionNode): string {
  return wrapAction(formatPipe(node.pipe), node.trim);
}

function formatBranch(
  keyword: "if" | "range" | "with",
  node: IfNode | RangeNode | WithNode,
): string {
  const head = wrapAction(`${keyword} ${formatPipe(node.pipe)}`, {
    trimLeft: node.trim.trimLeft,
    trimRight: false,
  });
  const list = stringify(node.list);
  const elsePart = node.elseList
    ? `${wrapAction("else", noTrim())}${stringify(node.elseList)}`
    : "";
  const tail = wrapAction("end", { trimLeft: false, trimRight: node.trim.trimRight });
  return `${head}${list}${elsePart}${tail}`;
}

function formatTemplate(node: TemplateNode): string {
  const arg = node.pipe ? ` ${formatPipe(node.pipe)}` : "";
  return wrapAction(`template ${JSON.stringify(node.name)}${arg}`, node.trim);
}

function formatBlock(node: BlockNode): string {
  const arg = node.pipe ? ` ${formatPipe(node.pipe)}` : "";
  const head = wrapAction(`block ${JSON.stringify(node.name)}${arg}`, {
    trimLeft: node.trim.trimLeft,
    trimRight: false,
  });
  const list = stringify(node.list);
  const tail = wrapAction("end", { trimLeft: false, trimRight: node.trim.trimRight });
  return `${head}${list}${tail}`;
}

function noTrim(): TrimMarkers {
  return { trimLeft: false, trimRight: false };
}
