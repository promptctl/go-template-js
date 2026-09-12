/**
 * `dict k1 v1 k2 v2 …` — builds a record from alternating key/value pairs.
 *
 * [LAW:single-enforcer] The boundary gate (`enforceArgTypes`) validates
 * the kv cycle via `arity: { kind: "alternating" }` against
 * `argTypes: ["string", "value"]`, so every key position is a string by
 * the time the body runs. The body trusts the gate; no per-key probe.
 *
 * Odd-length call (`dict "a"`) leaves the last value `undefined` —
 * matches Go sprig.
 */

import type { ReferencedArg, ReferencedLiteral } from "../../evaluator/evaluator.js";

export function dict(...kvs: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < kvs.length; i += 2) {
    out[kvs[i] as string] = kvs[i + 1];
  }
  return out;
}

/**
 * Statically read a `(dict k1 v1 …)` call argument's key/value pairs from a
 * {@link ReferencedArg} projection (see `Template.referencedCalls`).
 *
 * Returns the entries only when the argument is provably a literal dict: a
 * nested call named `dict` whose args are ALL literals, string-typed at every
 * key position, in complete pairs. Anything else — a non-`dict` call, a
 * dynamic entry (`(dict "k" .x)`), a non-string key (which would fail the
 * runtime arg gate anyway), an odd-length pair list — returns `null`: the
 * value is not statically readable, and a value is never guessed
 * [LAW:no-silent-failure].
 *
 * [LAW:one-source-of-truth] Lives beside — and folds through — the runtime
 * `dict` above, so the static reading and the evaluated value share one
 * pairing semantics (including later-wins on duplicate keys).
 */
export function staticDictEntries(arg: ReferencedArg): Record<string, ReferencedLiteral> | null {
  if (arg.kind !== "call" || arg.name !== "dict" || arg.args.length % 2 !== 0) return null;
  const values: ReferencedLiteral[] = [];
  for (const [i, entry] of arg.args.entries()) {
    if (entry.kind !== "literal") return null;
    if (i % 2 === 0 && typeof entry.value !== "string") return null;
    values.push(entry.value);
  }
  // Every value is a ReferencedLiteral and every key slot a string, in
  // complete pairs — the runtime fold cannot introduce `unknown` or
  // `undefined`, so the cast only restates what the loop established.
  return dict(...values) as Record<string, ReferencedLiteral>;
}
