/**
 * Engine<T> — generic-over-T template evaluator.
 *
 * [LAW:dataflow-not-control-flow] Evaluation is one switch on the AST
 * node's type. Every node kind has exactly one production rule; the
 * shape of work is fixed by the data, not by scattered branching.
 *
 * [LAW:single-enforcer] All `string → T` conversion goes through
 * `fromString`. There is exactly one place text becomes T. Function
 * returns of `string` are routed through the same converter on their
 * way to the output stream — the asymmetry between "string in / T out"
 * is encoded as a single function call, not duplicated at every site.
 *
 * Scope of *this* ticket (.1): single-command pipelines only, no `|`
 * chains, no control flow, no built-ins. The skeleton is structured
 * so .2/.3/.4 can fill in those productions without touching the
 * pieces this ticket owns.
 */

import {
  type ActionNode,
  assertNever,
  type CommandNode,
  type ListNode,
  type Node,
  type PipeNode,
} from "../parser/ast.js";
import type { Pos } from "../parser/pos.js";
import { MISSING, walkFieldChain } from "./access.js";
import { EvalError, FuncNotFoundError, TypeMismatchError } from "./errors.js";
import { declareVar, lookupVar, rootScope, type Scope } from "./scope.js";

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Declared parameter type for a registered template function. Used by
 * the no-silent-flatten guard to detect unsafe T-into-string flows.
 *
 * - "string" — must be a JS string. Non-string values raise
 *   TypeMismatchError. This is the **architectural commitment**: T
 *   never silently flattens into a string parameter.
 * - "number" — must be `typeof "number"` or `bigint`.
 * - "bool"   — must be `typeof "boolean"`.
 * - "T"      — opaque caller-defined T; treated as "anything that is
 *   not a string". The guard does no further checking.
 * - "any"    — accepts anything.
 */
export type ArgType = "string" | "number" | "bool" | "T" | "any";

export interface TemplateFunc {
  readonly fn: (...args: unknown[]) => unknown;
  /**
   * Declared positional parameter types. When omitted, every argument
   * is treated as `"any"` and the no-silent-flatten guard is inactive.
   * The pipe-fed last argument is checked against `argTypes[argTypes.length - 1]`.
   */
  readonly argTypes?: readonly ArgType[];
  readonly returnType?: ArgType;
}

export type FuncMap = Record<string, TemplateFunc>;

export interface EngineConfig<T> {
  /** Convert a text literal (or string-returning function result) into T. */
  readonly fromString: (s: string) => T;
  /** Optional registry of named functions usable in pipelines. */
  readonly funcs?: FuncMap;
}

export class Engine<T> {
  private readonly fromString: (s: string) => T;
  private readonly funcs: FuncMap;

  constructor(config: EngineConfig<T>) {
    this.fromString = config.fromString;
    this.funcs = config.funcs ?? {};
  }

  /** Evaluate a parsed AST against a scope value, producing a stream of T. */
  evaluate(ast: ListNode, scope: unknown, sourceText?: string): T[] {
    const out: T[] = [];
    const root = rootScope(scope);
    this.evalList(ast, root, out, sourceText);
    return out;
  }

  // -------------------------------------------------------------------
  // Statement-level dispatch (output-producing nodes).
  // -------------------------------------------------------------------

  private evalList(node: ListNode, scope: Scope, out: T[], src: string | undefined): void {
    for (const child of node.nodes) {
      this.evalNode(child, scope, out, src);
    }
  }

  private evalNode(node: Node, scope: Scope, out: T[], src: string | undefined): void {
    switch (node.type) {
      case "Text":
        out.push(this.fromString(node.text));
        return;
      case "Comment":
        return;
      case "Action": {
        const value = this.evalAction(node, scope, src);
        // Per Go's spec, actions whose pipeline declares variables
        // (`{{ $x := pipe }}`) contribute no output — they're pure
        // assignment statements. Only assignment-free actions emit.
        if (node.pipe.decls.length === 0) this.emitFromValue(value, out);
        return;
      }
      case "List":
        this.evalList(node, scope, out, src);
        return;
      case "If":
      case "Range":
      case "With":
      case "Template":
      case "Block":
        // [LAW:no-mode-explosion] These are control-flow productions
        // that subsequent tickets in this epic own. Failing loudly at
        // the boundary keeps the .1 surface honest about its scope.
        throw new EvalError(
          `${node.type} evaluation is not implemented yet (template-evaluator-cgm.3)`,
          node.pos,
          { source: src },
        );
      case "Pipe":
      case "Command":
      case "Identifier":
      case "Field":
      case "Variable":
      case "Chain":
      case "Dot":
      case "Nil":
      case "Bool":
      case "Number":
      case "String":
        // These are *expression* nodes — they should never appear as
        // statements at list level. If one does, the AST is malformed.
        throw new EvalError(`unexpected ${node.type} at statement position`, node.pos, {
          source: src,
        });
      default:
        assertNever(node);
    }
  }

  // -------------------------------------------------------------------
  // Expression-level dispatch (value-producing).
  // -------------------------------------------------------------------

  private evalAction(node: ActionNode, scope: Scope, src: string | undefined): unknown {
    return this.evalPipe(node.pipe, scope, src);
  }

  private evalPipe(pipe: PipeNode, scope: Scope, src: string | undefined): unknown {
    if (pipe.cmds.length === 0) {
      throw new EvalError("empty pipeline", pipe.pos, { source: src });
    }
    // First command runs unpiped; each subsequent command receives the
    // previous result as its trailing argument (Go's last-arg piping).
    let value: unknown = this.evalCommand(pipe.cmds[0] as CommandNode, scope, src, undefined);
    for (let i = 1; i < pipe.cmds.length; i++) {
      const next = pipe.cmds[i] as CommandNode;
      value = this.evalCommand(next, scope, src, value);
    }

    // Apply variable declarations / assignments after the pipe is
    // fully evaluated. Multi-decl tuple semantics are owned by `range`
    // in .3 and override this.
    if (pipe.decls.length > 0) {
      for (const decl of pipe.decls) {
        const name = decl.idents[0] ?? "$";
        declareVar(scope, name, value);
      }
    }
    return value;
  }

  private evalCommand(
    cmd: CommandNode,
    scope: Scope,
    src: string | undefined,
    pipedValue: unknown,
  ): unknown {
    if (cmd.args.length === 0) {
      throw new EvalError("empty command", cmd.pos, { source: src });
    }
    const head = cmd.args[0] as Node;

    // A command with a single argument that is not an identifier (or
    // is an identifier but we have a piped value) is either a value
    // expression or a piped lone-value flow.
    if (head.type !== "Identifier") {
      if (cmd.args.length > 1) {
        throw new EvalError(
          `cannot apply arguments to a ${head.type} primary; only functions take arguments`,
          cmd.pos,
          { source: src },
        );
      }
      const value = this.evalPrimary(head, scope, src);
      // A non-function command that receives a pipe value just returns
      // its own value — Go discards the pipe input in this position.
      // (In practice this rarely occurs; the parser only produces it
      // for trailing pipe-targets like `{{ pipe | .field }}`, which Go
      // disallows. We're permissive: prefer the explicit primary.)
      return value;
    }

    // Function call: head is the identifier; remaining args are the
    // function's positional inputs, followed by the piped value (if
    // any) as the last argument.
    const fn = this.funcs[head.ident];
    if (!fn) throw new FuncNotFoundError(head.ident, head.pos, { source: src });

    const argNodes = cmd.args.slice(1);
    const evaluated = argNodes.map((n) => this.evalPrimary(n, scope, src));
    if (pipedValue !== undefined) evaluated.push(pipedValue);

    enforceArgTypes(head.ident, fn.argTypes, evaluated, cmd.pos, src);
    return fn.fn(...evaluated);
  }

  private evalPrimary(node: Node, scope: Scope, src: string | undefined): unknown {
    switch (node.type) {
      case "Dot":
        return scope.dot;
      case "Nil":
        return null;
      case "Bool":
        return node.value;
      case "Number":
        return numberValue(node);
      case "String":
        return node.value;
      case "Field":
        return this.resolveFieldChain(scope.dot, node.idents, node.pos, src);
      case "Variable":
        return this.resolveVariable(node.idents, scope, node.pos, src);
      case "Identifier": {
        // A bare identifier in argument position is a zero-arg function
        // call (nullary functions like Go's builtin `true`/`false` once
        // a registry exists).
        const fn = this.funcs[node.ident];
        if (!fn) throw new FuncNotFoundError(node.ident, node.pos, { source: src });
        enforceArgTypes(node.ident, fn.argTypes, [], node.pos, src);
        return fn.fn();
      }
      case "Chain":
        // `(pipe).x.y` — evaluate the pipe and walk the field chain.
        return this.resolveFieldChain(
          this.evalPrimary(node.node, scope, src),
          node.fields,
          node.pos,
          src,
        );
      case "Pipe":
        // Parenthesised pipeline used as an argument.
        return this.evalPipe(node, scope, src);
      default:
        throw new EvalError(`cannot evaluate ${node.type} as a value`, node.pos, {
          source: src,
        });
    }
  }

  // -------------------------------------------------------------------
  // Field chains and variables.
  // -------------------------------------------------------------------

  private resolveFieldChain(
    receiver: unknown,
    idents: readonly string[],
    pos: Pos,
    src: string | undefined,
  ): unknown {
    const result = walkFieldChain(receiver, idents);
    if (result === MISSING) {
      throw new EvalError(`field "${idents.join(".")}" not found on receiver`, pos, {
        source: src,
      });
    }
    return result;
  }

  private resolveVariable(
    idents: readonly string[],
    scope: Scope,
    pos: Pos,
    src: string | undefined,
  ): unknown {
    const head = idents[0] ?? "$";
    if (head === "$") {
      // Bare `$` = root scope.
      const tail = idents.slice(1);
      return tail.length === 0 ? scope.root : this.resolveFieldChain(scope.root, tail, pos, src);
    }
    const lookup = lookupVar(scope, head);
    if (!lookup.found) {
      throw new EvalError(`undefined variable ${head}`, pos, { source: src });
    }
    const tail = idents.slice(1);
    return tail.length === 0 ? lookup.value : this.resolveFieldChain(lookup.value, tail, pos, src);
  }

  // -------------------------------------------------------------------
  // Output stream — `string`-typed values become T via `fromString`;
  // T-typed values flow through unchanged.
  // -------------------------------------------------------------------

  private emitFromValue(value: unknown, out: T[]): void {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      out.push(this.fromString(value));
      return;
    }
    // Anything else is assumed to be a T or a primitive — defer to the
    // caller's `fromString` after stringifying primitives, or push T
    // values directly. This is the entry point that .2 will refine
    // when it adds the "no silent flatten" guards.
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      out.push(this.fromString(String(value)));
      return;
    }
    out.push(value as T);
  }
}

// ---------------------------------------------------------------------------
// Convenience constructor matching the future public-API shape (.api.1).
// ---------------------------------------------------------------------------

export function createEngine<T>(config: EngineConfig<T>): Engine<T> {
  return new Engine(config);
}

// ---------------------------------------------------------------------------
// No-silent-flatten guard.
//
// [LAW:single-enforcer] This is the *one* place where argument types
// are validated against runtime values. Every function call routes
// through here. Adding a per-callsite shortcut would let drift creep
// in — fix the helper, not the callsite.
// ---------------------------------------------------------------------------

function enforceArgTypes(
  funcName: string,
  argTypes: readonly ArgType[] | undefined,
  values: readonly unknown[],
  pos: Pos,
  src: string | undefined,
): void {
  if (!argTypes) return;
  for (let i = 0; i < values.length; i++) {
    // If the function declares fewer types than args were passed, treat
    // the trailing args as "any". This lets variadic-style funcs opt
    // out of guarding once the head args are checked.
    const declared = argTypes[i] ?? "any";
    const value = values[i];
    if (matchesArgType(declared, value)) continue;
    throw new TypeMismatchError(
      funcName,
      i + 1,
      humanArgType(declared),
      describeValue(value),
      pos,
      { source: src },
    );
  }
}

function matchesArgType(declared: ArgType, value: unknown): boolean {
  switch (declared) {
    case "any":
      return true;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" || typeof value === "bigint";
    case "bool":
      return typeof value === "boolean";
    case "T":
      // Treat anything that isn't a primitive as a T-shaped value.
      // Primitives (string/number/bool/bigint/symbol) are excluded so
      // a T-typed slot doesn't silently accept a primitive that the
      // caller probably meant to wrap via fromString.
      return (
        value !== null &&
        value !== undefined &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean" &&
        typeof value !== "bigint" &&
        typeof value !== "symbol"
      );
  }
}

function humanArgType(t: ArgType): string {
  return t === "T" ? "T (consumer-defined fragment)" : `${t}`;
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Map) return "Map";
  return typeof value;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function numberValue(n: {
  readonly intValue?: bigint;
  readonly floatValue?: number;
  readonly complexValue?: readonly [number, number];
}): unknown {
  if (n.intValue !== undefined) {
    // Prefer Number for safe-range ints; bigint outside the safe range
    // (callers may opt into the bigint via the AST node directly).
    const bi = n.intValue;
    if (bi >= BigInt(Number.MIN_SAFE_INTEGER) && bi <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(bi);
    }
    return bi;
  }
  if (n.floatValue !== undefined) return n.floatValue;
  if (n.complexValue !== undefined) return n.complexValue;
  return undefined;
}
