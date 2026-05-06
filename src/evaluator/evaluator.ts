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
import { EvalError } from "./errors.js";
import { declareVar, lookupVar, rootScope, type Scope } from "./scope.js";

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export interface EngineConfig<T> {
  /** Convert a text literal (or string-returning function result) into T. */
  readonly fromString: (s: string) => T;
}

export class Engine<T> {
  private readonly fromString: (s: string) => T;

  constructor(config: EngineConfig<T>) {
    this.fromString = config.fromString;
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
    if (pipe.cmds.length !== 1) {
      // [LAW:no-mode-explosion] Multi-command pipelines (`|`) belong to
      // template-evaluator-cgm.2. Fail loudly at this boundary.
      throw new EvalError(
        "multi-command pipelines (`|`) are not implemented yet (template-evaluator-cgm.2)",
        pipe.pos,
        { source: src },
      );
    }
    const cmd = pipe.cmds[0];
    if (cmd === undefined) {
      throw new EvalError("empty pipeline", pipe.pos, { source: src });
    }
    const value = this.evalCommand(cmd, scope, src);

    // Apply variable declarations / assignments. The pipe's value is
    // bound to *every* declared name (Go's behavior for tuple-style
    // declarations is owned by `range` in .3 and overrides this).
    if (pipe.decls.length > 0) {
      for (const decl of pipe.decls) {
        const name = decl.idents[0] ?? "$";
        declareVar(scope, name, value);
      }
    }
    return value;
  }

  private evalCommand(cmd: CommandNode, scope: Scope, src: string | undefined): unknown {
    if (cmd.args.length === 0) {
      throw new EvalError("empty command", cmd.pos, { source: src });
    }
    if (cmd.args.length > 1) {
      // Multi-arg commands (function calls) are owned by .2 + .4.
      throw new EvalError(
        "function calls are not implemented yet (template-evaluator-cgm.2 / .4)",
        cmd.pos,
        { source: src },
      );
    }
    const head = cmd.args[0];
    if (head === undefined) {
      throw new EvalError("empty command", cmd.pos, { source: src });
    }
    return this.evalPrimary(head, scope, src);
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
      case "Identifier":
        // Bare identifiers without arguments = zero-arg function calls.
        // FuncMap dispatch lands in .2 / .4. Until then, fail loudly.
        throw new EvalError(
          `function ${JSON.stringify(node.ident)} is not implemented yet (template-evaluator-cgm.2 / .4)`,
          node.pos,
          { source: src },
        );
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
