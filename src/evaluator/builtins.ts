/**
 * Go template's built-in functions.
 *
 * https://pkg.go.dev/text/template#hdr-Functions
 *
 * Categories:
 *  - Eager (most): args evaluated normally, value-in / value-out.
 *  - Lazy (and/or): take thunks instead of values so evaluation can
 *    short-circuit. Branded with the internal `LAZY` symbol on the
 *    TemplateFunc — see evaluator.ts.
 *
 * [LAW:single-enforcer] Built-ins live in *one* exported FuncMap.
 * Consumers merge with their own funcs; user-supplied entries with
 * matching names override the built-in (intentional — gives
 * consumers an escape hatch).
 */

import type { FuncMap, TemplateFunc } from "./evaluator.js";
import { LAZY } from "./lazy.js";
import { isTruthy } from "./truthy.js";

// ---------------------------------------------------------------------------
// Eager built-ins.
// ---------------------------------------------------------------------------

const eagerBuiltins: FuncMap = {
  // Comparison — Go template promotes numeric types and compares
  // strings/bools by value. We match that by leaning on JS `<`/`===`
  // which already does the right thing for primitives.
  eq: {
    fn: (a: unknown, ...rest: unknown[]) => rest.some((r) => looseEq(a, r)),
    argTypes: ["any"],
  },
  ne: { fn: (a: unknown, b: unknown) => !looseEq(a, b), argTypes: ["any", "any"] },
  // [LAW:single-enforcer] `argTypes: ["ordered", "ordered"]` routes
  // both per-slot kind validation and the cross-slot same-kind rule
  // through `enforceArgTypes`. By the time `compare` runs, the args
  // are guaranteed orderable and same-kinded, so it can be a thin
  // numeric/lexicographic body — no defensive cross-type check.
  lt: { fn: (a: unknown, b: unknown) => compare(a, b) < 0, argTypes: ["ordered", "ordered"] },
  le: { fn: (a: unknown, b: unknown) => compare(a, b) <= 0, argTypes: ["ordered", "ordered"] },
  gt: { fn: (a: unknown, b: unknown) => compare(a, b) > 0, argTypes: ["ordered", "ordered"] },
  ge: { fn: (a: unknown, b: unknown) => compare(a, b) >= 0, argTypes: ["ordered", "ordered"] },

  // Length of strings, arrays, Maps, Sets, plain objects.
  len: { fn: (v: unknown) => goLen(v), argTypes: ["any"] },

  // Positional access on collections. `index x i j` walks i, then j…
  index: {
    fn: (collection: unknown, ...keys: unknown[]) => {
      let cur: unknown = collection;
      for (const k of keys) cur = goIndex(cur, k);
      return cur;
    },
    argTypes: ["any"],
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

  // Formatted printers.
  print: { fn: (...args: unknown[]) => goPrint(args), argTypes: ["any"], returnType: "string" },
  println: {
    fn: (...args: unknown[]) => `${goPrint(args)}\n`,
    argTypes: ["any"],
    returnType: "string",
  },
  printf: {
    fn: (format: unknown, ...args: unknown[]) => sprintf(String(format), args),
    argTypes: ["string", "any"],
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

// ---------------------------------------------------------------------------
// Lazy short-circuiting forms.
//
// `and a b c …` returns the first falsy argument, or the last argument
// if all are truthy. `or` is the dual. Branded with the internal LAZY
// symbol so the dispatcher hands them thunks instead of values; their
// declared `argTypes: ["any"]` makes the no-silent-flatten guard a
// no-op against thunks.
// ---------------------------------------------------------------------------

const lazyBuiltins: FuncMap = {
  and: {
    [LAZY]: true,
    argTypes: ["any"],
    fn: (...thunks: unknown[]) => {
      let last: unknown = true;
      for (const t of thunks) {
        last = (t as () => unknown)();
        if (!isTruthy(last)) return last;
      }
      return last;
    },
  },
  or: {
    [LAZY]: true,
    argTypes: ["any"],
    fn: (...thunks: unknown[]) => {
      let last: unknown = false;
      for (const t of thunks) {
        last = (t as () => unknown)();
        if (isTruthy(last)) return last;
      }
      return last;
    },
  },
};

// ---------------------------------------------------------------------------
// Public default registry.
// ---------------------------------------------------------------------------

export function defaultBuiltins(): FuncMap {
  return { ...eagerBuiltins, ...lazyBuiltins };
}

export function isLazy(fn: TemplateFunc): boolean {
  return fn[LAZY] === true;
}

// ---------------------------------------------------------------------------
// Comparison + length + index helpers (Go-template semantics).
// ---------------------------------------------------------------------------

function looseEq(a: unknown, b: unknown): boolean {
  // Go's `eq` promotes numeric types; JS `===` already treats 1 === 1n
  // as false, but `==` would coerce. We compromise: numeric comparison
  // bridges number/bigint; otherwise strict equality.
  if (typeof a === "number" && typeof b === "bigint") return BigInt(a) === b;
  if (typeof a === "bigint" && typeof b === "number") return a === BigInt(b);
  return a === b;
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
  if (value === null || value === undefined) {
    throw new Error("len: argument is nil");
  }
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.length;
  if (value instanceof Map) return value.size;
  if (value instanceof Set) return value.size;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  throw new Error(`len: cannot take length of ${describeType(value)}`);
}

function goIndex(collection: unknown, key: unknown): unknown {
  if (collection === null || collection === undefined) {
    throw new Error("index: indexing into nil");
  }
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
  if (typeof collection === "object") {
    return (collection as Record<string, unknown>)[String(key)];
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

function goPrint(args: readonly unknown[]): string {
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
    out += stringifyForPrint(arg);
    prevIsString = isString;
  }
  return out;
}

function stringifyForPrint(value: unknown): string {
  if (value === null || value === undefined) return "<nil>";
  if (typeof value === "string") return value;
  return String(value);
}

function sprintf(format: string, args: readonly unknown[]): string {
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
    out += formatVerb(verb ?? "", spec, arg);
    i = j + 1;
  }
  return out;
}

function formatVerb(verb: string, spec: string, arg: unknown): string {
  switch (verb) {
    case "s":
      return typeof arg === "string"
        ? applyWidth(spec, arg)
        : applyWidth(spec, stringifyForPrint(arg));
    case "d": {
      const n = typeof arg === "bigint" ? arg : Math.trunc(Number(arg));
      return applyWidth(spec, String(n));
    }
    case "v":
      return applyWidth(spec, formatV(arg));
    case "q":
      return applyWidth(spec, JSON.stringify(stringifyForPrint(arg)));
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
      return `%!${verb}(${describeType(arg)}=${stringifyForPrint(arg)})`;
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
