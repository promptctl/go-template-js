/**
 * Public entrypoint for go-template-js.
 *
 * The engine is generic over its output type; concrete rendering arrives
 * in subsequent tickets. For now this module exposes the AST contract so
 * downstream code (parser, evaluator, tooling) has a stable shape to
 * build against.
 */

export { EvalError, FuncNotFoundError, TypeMismatchError } from "./evaluator/errors.js";
export {
  type ArgType,
  createEngine,
  Engine,
  type EngineConfig,
  type FuncMap,
  type TemplateFunc,
} from "./evaluator/evaluator.js";
export type {
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
  NodeOf,
  NodeType,
  NumberNode,
  PipeNode,
  RangeNode,
  StringNode,
  TemplateNode,
  TextNode,
  TrimMarkers,
  VariableNode,
  WithNode,
} from "./parser/ast.js";
export { assertNever, NO_TRIM } from "./parser/ast.js";
export { ParseError } from "./parser/errors.js";
export { Lexer, type Token, type TokenType, tokenize } from "./parser/lexer.js";
export { type ParseResult, parse } from "./parser/parser.js";
export type { Pos } from "./parser/pos.js";
export { pos } from "./parser/pos.js";
export { stringify } from "./parser/stringify.js";
export { children, flatten, tally, type Visitor, walk } from "./parser/walk.js";
export { sprigDefaults } from "./sprig/defaults/index.js";
export { sprigDicts } from "./sprig/dicts/index.js";
export { sprigLists } from "./sprig/lists/index.js";
export { sprigMath } from "./sprig/math/index.js";
export { sprigStrings } from "./sprig/strings/index.js";
