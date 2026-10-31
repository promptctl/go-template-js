/**
 * Evaluation provenance: which marked calls a value depends on.
 *
 * A registered func marks the call it is in by returning
 * `marked(value, ...tokens)`. The engine unwraps the carrier at its one
 * dispatch site and the tokens travel beside the value — through every
 * variable and dot it is bound into, onto every action that reads it —
 * until a hook reports them (`EngineConfig.emitted` / `decided`).
 *
 * [LAW:types-are-the-program] Provenance rides beside values, never on
 * them: a number or a string cannot carry a fact, and a wrapper that
 * reached a template value would change what every slot matcher sees.
 * So the carrier exists only between a func body's return and `invoke`;
 * nothing downstream of `invoke` can be handed one.
 */

/** The set of marks a value or an emission depends on. */
export type Marks = ReadonlySet<unknown>;

export const NO_MARKS: Marks = new Set();

// Declared before the class: its static block assigns them as the class
// is defined, and a `let` read or written before its line is in the TDZ.
let createMarked: (value: unknown, marks: readonly unknown[]) => Marked;

// [LAW:single-enforcer] The one reader of a carrier, called only by the
// engine's dispatch site: the marks join the reading pipe's set and the
// plain value continues as the call's result.
export let readCarrier: (result: unknown, into: Set<unknown>) => unknown;

/**
 * A func's return value together with the marks of the call that
 * produced it. Opaque: build one with {@link marked}; only the engine
 * reads it.
 */
export class Marked {
  readonly #value: unknown;
  readonly #marks: readonly unknown[];

  private constructor(value: unknown, marks: readonly unknown[]) {
    this.#value = value;
    this.#marks = marks;
  }

  static {
    createMarked = (value, marks) =>
      // `marked(marked(v, a), b)` is one carrier with both marks, so a
      // func that wraps another func's result never hides the inner mark.
      value instanceof Marked
        ? new Marked(value.#value, [...value.#marks, ...marks])
        : new Marked(value, marks);
    readCarrier = (result, into) => {
      if (!(result instanceof Marked)) return result;
      for (const mark of result.#marks) into.add(mark);
      return result.#value;
    };
  }
}

/**
 * Return this from a registered func to mark the call: every emission
 * and control decision that depends on the call's result reports
 * `marks`. The template sees `value`, exactly as if it had been returned
 * directly.
 */
export function marked(value: unknown, ...marks: unknown[]): Marked {
  return createMarked(value, marks);
}

/**
 * Per evaluation: the marks a call may have written into each object.
 *
 * A func can change an object it is handed (sprig `set`, `unset`,
 * `merge` do), so a mark can reach the output through an object no
 * marked binding points at: `{{ $_ := set $d "k" (tween …) }}{{ $d.k }}`
 * reads `$d`, whose binding was made before the write. Marks therefore
 * also live on the objects themselves, and a read of an object picks
 * them up. Scoped to one evaluation, so a plain `Map` is the owner and
 * its size says whether any write has happened at all.
 */
export type WrittenMarks = Map<object, Set<unknown>>;

function isHeapObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

// Every object reachable from `roots`, each once: array elements, Map
// keys and values, Set members, own enumerable values. One traversal, so
// what a write can reach and what a read can see are the same set.
function* reachable(roots: readonly unknown[]): Generator<object> {
  const seen = new Set<object>();
  const pending = roots.filter(isHeapObject);
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (seen.has(next)) continue;
    seen.add(next);
    yield next;
    const children =
      next instanceof Map
        ? [...next.keys(), ...next.values()]
        : next instanceof Set
          ? [...next]
          : Object.values(next);
    for (const child of children) if (isHeapObject(child)) pending.push(child);
  }
}

/**
 * After a call, every object reachable from its arguments may now hold a
 * value that depends on the call's inputs (`marks`). Reachable, not just
 * the argument: a func may write into nested structure, and an alias
 * bound earlier (`$a := $d.a`) must see that write too. With no marks a
 * write carries nothing, so nothing is walked.
 */
export function markWritable(args: readonly unknown[], marks: Marks, written: WrittenMarks): void {
  if (marks.size === 0) return;
  for (const object of reachable(args)) {
    const into = written.get(object) ?? new Set<unknown>();
    for (const mark of marks) into.add(mark);
    written.set(object, into);
  }
}

/**
 * A read of `value` reads everything it contains, so whatever a call
 * wrote anywhere inside it joins `reads` — `{{ $d }}` after
 * `set $d.a "k" …` depends on the write. Nothing is walked until some
 * write has happened.
 */
export function readReachable(value: unknown, reads: Set<unknown>, written: WrittenMarks): void {
  if (written.size === 0) return;
  for (const object of reachable([value])) readObject(object, reads, written);
}

/**
 * A field chain passing through `step` reads that one object: a write to
 * `.a` reaches `.a.k`, and a write to `.b` does not.
 */
export function readObject(step: unknown, reads: Set<unknown>, written: WrittenMarks): void {
  if (!isHeapObject(step)) return;
  for (const mark of written.get(step) ?? NO_MARKS) reads.add(mark);
}

/** `a ∪ b`, sharing an operand when the other is empty. */
export function unionMarks(a: Marks, b: Marks): Marks {
  if (b.size === 0) return a;
  if (a.size === 0) return b;
  return new Set([...a, ...b]);
}
