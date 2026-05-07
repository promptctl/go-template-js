/**
 * Go template's built-in functions.
 *
 * https://pkg.go.dev/text/template#hdr-Functions
 *
 * Categories:
 *  - Eager (most): args evaluated normally, value-in / value-out.
 *  - Lazy (and/or): take thunks instead of values so evaluation can
 *    short-circuit. Registered via `markLazy` — see lazy.ts.
 *
 * [LAW:single-enforcer] Built-ins live in *one* exported FuncMap.
 * Consumers merge with their own funcs; user-supplied entries with
 * matching names override the built-in (intentional — gives
 * consumers an escape hatch).
 */

import { deepEqual } from "../sprig/types/deepEqual.js";
import type { FuncMap } from "./evaluator.js";
import { markLazy } from "./lazy.js";
import { isTruthy } from "./truthy.js";

// ---------------------------------------------------------------------------
// Eager built-ins.
//
// [LAW:single-enforcer] The print/printf family closes over the
// engine's `toString` so that the value flattening uses the same
// function the `"stringifiable"` matcher probes with. Two callsites
// (probe at the gate, flatten in the body) — one source of truth.
// ---------------------------------------------------------------------------

function eagerBuiltins(toString: (v: unknown) => string): FuncMap {
  return {
    // Comparison — Go template promotes numeric types and compares
    // strings/bools by value. We match that by leaning on JS `<`/`===`
    // which already does the right thing for primitives.
    // [LAW:single-enforcer] `argTypes: ["comparable"]` puts the kind
    // check + cross-slot same-kind rule (with number↔bigint bridged and
    // nil-wildcarded) at the gate. The body trusts kinds and routes
    // structural compares through `deepEqual`. Variadic per Go: `eq a
    // b c` is true if any of b, c equals a.
    eq: {
      fn: (a: unknown, ...rest: unknown[]) => rest.some((r) => goEqPair(a, r)),
      argTypes: ["comparable"],
    },
    ne: {
      fn: (a: unknown, b: unknown) => !goEqPair(a, b),
      argTypes: ["comparable", "comparable"],
    },
    // [LAW:single-enforcer] `argTypes: ["ordered", "ordered"]` routes
    // both per-slot kind validation and the cross-slot same-kind rule
    // through `enforceArgTypes`. By the time `compare` runs, the args
    // are guaranteed orderable and same-kinded, so it can be a thin
    // numeric/lexicographic body — no defensive cross-type check.
    lt: { fn: (a: unknown, b: unknown) => compare(a, b) < 0, argTypes: ["ordered", "ordered"] },
    le: { fn: (a: unknown, b: unknown) => compare(a, b) <= 0, argTypes: ["ordered", "ordered"] },
    gt: { fn: (a: unknown, b: unknown) => compare(a, b) > 0, argTypes: ["ordered", "ordered"] },
    ge: { fn: (a: unknown, b: unknown) => compare(a, b) >= 0, argTypes: ["ordered", "ordered"] },

    // [LAW:single-enforcer] `len` declares "sized" so the gate rejects
    // numbers/booleans/nil once with TypeMismatchError. The body trusts
    // the kind and only fans out the per-kind size readout.
    len: { fn: (v: unknown) => goLen(v), argTypes: ["sized"] },

    // [LAW:single-enforcer] `index x i j` walks i, then j. The first
    // slot is "collection" (string | array | Map | dict); every key
    // slot is "index-key" (string | number | bigint). The body trusts
    // the gate — nil/Set/class-instance receivers are rejected before
    // it runs. Closes audit finding B5: typed-T keys no longer
    // silently `String(key)`-flatten on object collections.
    index: {
      fn: (collection: unknown, ...keys: unknown[]) => {
        let cur: unknown = collection;
        for (const k of keys) cur = goIndex(cur, k);
        return cur;
      },
      argTypes: ["collection", "index-key"],
    },

    // `slice x i j` — array/slice/string slicing.
    slice: {
      fn: (collection: unknown, ...indices: unknown[]) => {
        const i = indices.length >= 1 ? Number(indices[0]) : 0;
        const j = indices.length >= 2 ? Number(indices[1]) : undefined;
        if (typeof collection === "string") {
          return collection.slice(i, j);
        }
        if (Array.isArray(collection)) {
          return collection.slice(i, j);
        }
        throw new Error(`slice: cannot slice value of type ${describeType(collection)}`);
      },
      argTypes: ["any"],
    },

    // [LAW:single-enforcer] Formatted printers declare "stringifiable"
    // so the gate probes each non-string arg through `engine.toString`.
    // Bodies re-call `toString` to actually flatten — same source of
    // truth as the matcher. Closes audit findings B1–B4: typed-T no
    // longer silently `String(v)`-flattens to "[object Object]".
    print: {
      fn: (...args: unknown[]) => goPrint(args, toString),
      argTypes: ["stringifiable"],
      returnType: "string",
    },
    println: {
      fn: (...args: unknown[]) => `${goPrint(args, toString)}\n`,
      argTypes: ["stringifiable"],
      returnType: "string",
    },
    printf: {
      fn: (format: string, ...args: unknown[]) => sprintf(format, args, toString),
      argTypes: ["string", "stringifiable"],
      returnType: "string",
    },

    // Invokes a JS function value pulled out of the scope.
    call: {
      fn: (fn: unknown, ...args: unknown[]) => {
        if (typeof fn !== "function") {
          throw new Error("call: first argument must be a function");
        }
        return (fn as (...a: unknown[]) => unknown)(...args);
      },
      argTypes: ["any"],
    },

    // `not` is also lazy in spirit, but with a single argument it's
    // semantically equivalent to eager evaluation. Keep it eager.
    not: { fn: (v: unknown) => !isTruthy(v), argTypes: ["any"] },
  };
}

// ---------------------------------------------------------------------------
// Lazy short-circuiting forms.
//
// `and a b c …` returns the first falsy argument, or the last argument
// if all are truthy. `or` is the dual. Registered via `markLazy` so the
// dispatcher hands them thunks instead of values; their declared
// `argTypes: ["any"]` makes the no-silent-flatten guard a no-op against
// thunks.
// ---------------------------------------------------------------------------

function lazyBuiltins(): FuncMap {
  return {
    and: markLazy({
      argTypes: ["any"],
      fn: (...thunks: unknown[]) => {
        let last: unknown = true;
        for (const t of thunks) {
          last = (t as () => unknown)();
          if (!isTruthy(last)) return last;
        }
        return last;
      },
    }),
    or: markLazy({
      argTypes: ["any"],
      fn: (...thunks: unknown[]) => {
        let last: unknown = false;
        for (const t of thunks) {
          last = (t as () => unknown)();
          if (isTruthy(last)) return last;
        }
        return last;
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Public default registry.
// ---------------------------------------------------------------------------

export function defaultBuiltins(toString: (v: unknown) => string): FuncMap {
  return { ...eagerBuiltins(toString), ...lazyBuiltins() };
}

// ---------------------------------------------------------------------------
// Comparison + length + index helpers (Go-template semantics).
// ---------------------------------------------------------------------------

function goEqPair(a: unknown, b: unknown): boolean {
  // Go-template `eq` semantics: numeric kinds bridge (1 == 1n), and
  // structural values (arrays, plain objects, Maps, Sets) compare by
  // deep equality. The gate already enforces same-kind for the slots,
  // so this only needs to compute equality — never reject.
  if (typeof a === "number" && typeof b === "bigint") return BigInt(a) === b;
  if (typeof a === "bigint" && typeof b === "number") return a === BigInt(b);
  return deepEqual(a, b);
}

function compare(a: unknown, b: unknown): number {
  // [LAW:single-enforcer] Same-kind invariant is enforced by
  // `enforceArgTypes` ahead of this call (via `argTypes: ["ordered",
  // "ordered"]`). Here we only compute the ordering — no cross-type
  // defensive logic needed.
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof a === "bigint" || typeof b === "bigint") {
    const an = typeof a === "bigint" ? a : BigInt(Math.trunc(Number(a)));
    const bn = typeof b === "bigint" ? b : BigInt(Math.trunc(Number(b)));
    return an === bn ? 0 : an < bn ? -1 : 1;
  }
  // a and b are guaranteed same-kind (string/number/boolean) at this
  // point, so the ordering is a direct primitive compare.
  const x = a as string | number | boolean;
  const y = b as string | number | boolean;
  return x === y ? 0 : x < y ? -1 : 1;
}

function goLen(value: unknown): number {
  // [LAW:single-enforcer] Kind already validated by `enforceArgTypes`
  // against argTypes: ["sized"]. Body picks the per-kind size readout;
  // no defensive nil / non-sized throws here — the gate caught those.
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.length;
  if (value instanceof Map) return value.size;
  if (value instanceof Set) return value.size;
  return Object.keys(value as Record<string, unknown>).length;
}

function goIndex(collection: unknown, key: unknown): unknown {
  // [LAW:single-enforcer] The gate validates the *initial* collection
  // and key shapes. Mid-walk, `collection` is whatever the previous
  // step returned — so the body keeps a "cannot index" defense for
  // intermediate non-collection values (e.g., a leaf number). The nil
  // case is folded into that catch-all.
  if (Array.isArray(collection)) {
    const i = Number(key);
    if (!Number.isInteger(i))
      throw new Error(`index: array index must be integer, got ${describeType(key)}`);
    if (i < 0 || i >= collection.length) {
      throw new Error(`index: out of range [${i}] with length ${collection.length}`);
    }
    return collection[i];
  }
  if (collection instanceof Map) {
    return collection.get(key);
  }
  if (typeof collection === "string") {
    const i = Number(key);
    return collection[i];
  }
  if (collection !== null && typeof collection === "object") {
    // Closes B5: no silent `String(key)`. Object access requires a
    // string key; numeric/bigint keys for an object collection are a
    // body-level kind error (the gate's per-slot rule can't express
    // "key kind depends on receiver kind" without cross-slot logic).
    if (typeof key !== "string") {
      throw new Error(`index: object index must be string, got ${describeType(key)}`);
    }
    return (collection as Record<string, unknown>)[key];
  }
  throw new Error(`index: cannot index ${describeType(collection)}`);
}

function describeType(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "Map";
  return typeof v;
}

// ---------------------------------------------------------------------------
// Print + sprintf.
//
// We support %s, %d, %v, %q, %f, %t, %x — the verbs explicitly listed
// in the parser-evaluator-cgm epic. Unknown verbs pass through as
// `%!<verb>(<arg>)` matching Go's diagnostic style.
// ---------------------------------------------------------------------------

function goPrint(args: readonly unknown[], toString: (v: unknown) => string): string {
  // Go's `fmt.Sprint`: emits a space between adjacent operands when
  // *neither* of the two flanking values is a string. So `x` `1` is
  // joined as `x1` (string adjacent), but `1` `true` is joined as
  // `1 true` (neither is a string).
  let out = "";
  let prevIsString = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isString = typeof arg === "string";
    if (i > 0 && !prevIsString && !isString) out += " ";
    out += stringifyForPrint(arg, toString);
    prevIsString = isString;
  }
  return out;
}

// [LAW:single-enforcer] No `String(value)` here — the gate guarantees
// each arg is `"stringifiable"`. nil keeps Go-parity ("<nil>"); strings
// pass through; anything else routes through the engine's `toString`.
function stringifyForPrint(value: unknown, toString: (v: unknown) => string): string {
  if (value === null || value === undefined) return "<nil>";
  if (typeof value === "string") return value;
  return toString(value);
}

function sprintf(
  format: string,
  args: readonly unknown[],
  toString: (v: unknown) => string,
): string {
  let out = "";
  let argIdx = 0;
  let i = 0;
  while (i < format.length) {
    const ch = format[i];
    if (ch !== "%") {
      out += ch;
      i += 1;
      continue;
    }
    if (format[i + 1] === "%") {
      out += "%";
      i += 2;
      continue;
    }
    // Read optional flags + width + precision before the verb.
    let j = i + 1;
    while (j < format.length && "+-# 0".includes(format[j] ?? "")) j += 1;
    while (j < format.length && format[j] !== undefined && /[0-9]/.test(format[j] as string))
      j += 1;
    if (format[j] === ".") {
      j += 1;
      while (j < format.length && format[j] !== undefined && /[0-9]/.test(format[j] as string))
        j += 1;
    }
    const verb = format[j];
    const spec = format.slice(i + 1, j);
    const arg = args[argIdx++];
    out += formatVerb(verb ?? "", spec, arg, toString);
    i = j + 1;
  }
  return out;
}

function formatVerb(
  verb: string,
  spec: string,
  arg: unknown,
  toString: (v: unknown) => string,
): string {
  switch (verb) {
    case "s":
      return typeof arg === "string"
        ? applyWidth(spec, arg)
        : applyWidth(spec, stringifyForPrint(arg, toString));
    case "d": {
      const n = typeof arg === "bigint" ? arg : Math.trunc(Number(arg));
      return applyWidth(spec, String(n));
    }
    case "v":
      return applyWidth(spec, formatV(arg));
    case "q":
      return applyWidth(spec, JSON.stringify(stringifyForPrint(arg, toString)));
    case "f": {
      const precision = spec.includes(".") ? Number(spec.split(".")[1]) : 6;
      const n = Number(arg);
      return applyWidth(spec, n.toFixed(precision));
    }
    case "t":
      return applyWidth(spec, isTruthy(arg) ? "true" : "false");
    case "x": {
      if (typeof arg === "bigint") return applyWidth(spec, arg.toString(16));
      const n = Math.trunc(Number(arg));
      return applyWidth(spec, n.toString(16));
    }
    default:
      return `%!${verb}(${describeType(arg)}=${stringifyForPrint(arg, toString)})`;
  }
}

function applyWidth(spec: string, body: string): string {
  // Parse width and the `-` (left-align) flag from the spec — anything
  // before a `.` and not in the flag set is the width.
  const flag = spec.match(/^([+\-# 0]*)/)?.[1] ?? "";
  const widthMatch = spec.slice(flag.length).match(/^(\d+)/);
  if (!widthMatch) return body;
  const width = Number(widthMatch[1]);
  if (body.length >= width) return body;
  const pad = " ".repeat(width - body.length);
  return flag.includes("-") ? body + pad : pad + body;
}

function formatV(value: unknown): string {
  if (value === null || value === undefined) return "<nil>";
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(formatV).join(" ")}]`;
  if (value instanceof Map) {
    return `map[${[...value.entries()].map(([k, v]) => `${formatV(k)}:${formatV(v)}`).join(" ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.values(value).map(formatV).join(" ")}}`;
  }
  return String(value);
}
