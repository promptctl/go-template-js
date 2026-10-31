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

/** `a ∪ b`, sharing an operand when the other is empty. */
export function unionMarks(a: Marks, b: Marks): Marks {
  if (b.size === 0) return a;
  if (a.size === 0) return b;
  return new Set([...a, ...b]);
}
