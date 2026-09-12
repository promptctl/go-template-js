/**
 * One witness pair per `ArgType`: a value the slot accepts, and a value
 * it rejects.
 *
 * [LAW:one-source-of-truth] Two harnesses need to build a call that the
 * gate must reject at one chosen slot and accept at every other, so both
 * need "what does this slot take?" — `no-silent-flatten-universal`
 * carried its own `fillerFor` switch, and the arity-gate hierarchy sweep
 * would have grown a second one. A second table is a second clock: the
 * day a matcher tightens, one of them keeps passing stale values and its
 * sweep quietly stops proving anything. So the table lives here once and
 * both read it.
 *
 * [LAW:types-are-the-program] Both halves are `Record`s over the kind
 * union, not switches with a fall-through: adding an `ArgType` fails to
 * compile until it is either given witnesses or named `Permissive`. The
 * gap this closes was live — `fillerFor` had no `"liftable"` arm and
 * silently filled that slot with `undefined`, which the matcher rejects.
 * No shipped registration declares `"liftable"` yet, so the hole never
 * fired; a `Record` makes the next one impossible instead of unlucky.
 *
 * Witnesses are chosen against the engine's *default* `isT` and
 * `toString`, because that is what both harnesses run under. Where a
 * witness turns on what those admit, the entry says so.
 */

import type { ArgType } from "../../src/evaluator/evaluator.js";

/**
 * Kinds whose matcher returns `true` for every value. They have no
 * reject witness because no value exists that would serve as one —
 * which is why `REJECTED` is keyed on the complement rather than
 * carrying a `none` sentinel the reader has to remember to check.
 */
export type PermissiveArgType = "truthy" | "reflective" | "value";

/** A value the slot admits. Used to fill the slots not under test. */
export const ACCEPTED: Readonly<Record<ArgType, unknown>> = {
  string: "x",
  int: 0,
  float: 0,
  bool: false,
  // A plain object is a T under DEFAULT_IS_T.
  T: {},
  ordered: 0,
  list: [],
  dict: {},
  sized: "",
  comparable: 0,
  stringifiable: "x",
  // The string half of the string→T bridge; the gate lifts it via
  // `fromString` after the match, so bodies still see a T.
  liftable: "x",
  callable: () => undefined,
  collection: [],
  "index-key": 0,
  sliceable: "",
  serializable: 0,
  truthy: "x",
  reflective: "x",
  value: "x",
};

/**
 * A value the slot refuses. Each one is the *shape* the matcher excludes,
 * not an edge case: a number where a string is wanted, a string where a
 * structure is wanted, a function where a value must be comparable or
 * JSON-encodable.
 */
export const REJECTED: Readonly<Record<Exclude<ArgType, PermissiveArgType>, unknown>> = {
  string: 1,
  int: "x",
  float: "x",
  bool: "x",
  // Not a string and not an object, so neither a T nor liftable.
  T: 1,
  liftable: 1,
  // A plain object has no ordering.
  ordered: {},
  list: "x",
  // Go-parity: a string is not a dict, a list, or a collection.
  dict: "x",
  sized: 1,
  collection: 1,
  sliceable: 1,
  // Functions are neither comparable nor JSON-encodable.
  comparable: () => undefined,
  serializable: () => undefined,
  // The default `toString` flattens every scalar (numbers, bigints,
  // booleans, nil) and refuses only structures, so the witness has to be
  // one — a number would be accepted here.
  stringifiable: {},
  // Keys are string | number | bigint; a boolean is not one.
  "index-key": true,
  callable: "x",
};

/**
 * Does this kind refuse anything at all?
 *
 * [LAW:one-source-of-truth] Read off `REJECTED` rather than re-listing
 * the permissive kinds, so "which kinds are permissive" has exactly one
 * home — the shape of the table itself.
 */
export const hasRejectWitness = (t: ArgType): t is Exclude<ArgType, PermissiveArgType> =>
  Object.hasOwn(REJECTED, t);
