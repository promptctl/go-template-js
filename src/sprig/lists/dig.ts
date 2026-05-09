/**
 * `dig key1 key2 … default dict` — walks nested dict by string keys,
 * returning the deepest value found, or `default` when a key along
 * the path is missing.
 *
 * The argument shape is *positional from the end*:
 *
 *     dig "a" "b" "c" <default> <dict>
 *
 * — last arg is the dict, the one before it is the default, every
 * preceding arg is a string key. This shape comes straight from Go
 * sprig and is unintuitive but documented.
 *
 * [LAW:single-enforcer] exception: `argTypes: ["value"]` (variadic
 * trailing slot) — the from-the-end positional shape cannot be
 * expressed by the gate's positional-from-the-start + trailing-repeat
 * model. We accept body-side validation here and use
 * `bodyTypeMismatch` so failures still surface as TypeMismatchError
 * with the correct call-site pos.
 */

import { bodyTypeMismatch } from "../../evaluator/errors.js";

export function dig(...args: unknown[]): unknown {
  if (args.length < 3) {
    // Match Go's `panic("dig needs at least three arguments")`.
    throw bodyTypeMismatch(
      "dig",
      0,
      "at least 3 arguments (...keys, default, dict)",
      `${args.length} argument${args.length === 1 ? "" : "s"}`,
    );
  }
  const dict = args[args.length - 1];
  const def = args[args.length - 2];
  const keys = args.slice(0, -2);

  if (!isPlainDict(dict)) {
    throw bodyTypeMismatch("dig", args.length - 1, "dict", describeKind(dict));
  }
  for (let i = 0; i < keys.length; i++) {
    if (typeof keys[i] !== "string") {
      throw bodyTypeMismatch("dig", i, "string", describeKind(keys[i]));
    }
  }

  return digFromDict(dict as Record<string, unknown>, def, keys as string[], args.length);
}

function digFromDict(
  d: Record<string, unknown>,
  def: unknown,
  ks: readonly string[],
  argCount: number,
): unknown {
  const k = ks[0] as string;
  if (!Object.hasOwn(d, k)) return def;
  const step = d[k];
  if (ks.length === 1) return step;
  // Go would `step.(map[string]interface{})` here, panicking on a
  // non-map intermediate. Mirror that — surface it as a typed error
  // rather than letting JS coerce silently.
  if (!isPlainDict(step)) {
    // Attribute to dict arg (last arg position).
    throw bodyTypeMismatch("dig", argCount - 1, "dict at intermediate key", describeKind(step));
  }
  return digFromDict(step as Record<string, unknown>, def, ks.slice(1), argCount);
}

function isPlainDict(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !(v instanceof Map) &&
    !(v instanceof Set)
  );
}

function describeKind(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "Map";
  if (v instanceof Set) return "Set";
  return typeof v;
}
