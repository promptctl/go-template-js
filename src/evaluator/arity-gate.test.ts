/**
 * The argument-count gate (template-arity-n2j.49n).
 *
 * [LAW:behavior-not-structure] Everything here goes through a real
 * engine and asserts the contract a template author observes: which
 * calls are accepted, which are rejected, what the rejection says, and
 * where it points. Nothing reaches for `acceptedArgCount` — a
 * different derivation of the same rule would have to pass these
 * tests unchanged.
 *
 * Go's message *text* is not pinned here. It is pinned by the
 * conformance corpus, where `pnpm conformance:regen` generates it from
 * the reference implementation — see the `negative-arity-*` fixtures and
 * `test/conformance/string-mode.test.ts`. A hand-transcribed copy of
 * that text beside the generated one would be a second clock, and the
 * hand-written one is the one that goes stale. [LAW:one-source-of-truth]
 *
 * What stays here is everything the corpus cannot say: which counts are
 * rejected at all, the structured fields a consumer branches on, and
 * where the error points.
 */

import { describe, expect, it } from "vitest";
import { ACCEPTED, hasRejectWitness, REJECTED } from "../../test/support/arg-type-witnesses.js";
import {
  ArgCountError,
  type ArgType,
  createEngine,
  type FuncMap,
  sprigConversions,
  sprigDatetime,
  sprigDefaults,
  sprigDicts,
  sprigFlow,
  sprigHash,
  sprigLists,
  sprigMath,
  sprigRandom,
  sprigRegex,
  sprigSemver,
  sprigStrings,
  sprigTypes,
  TemplateError,
  type TemplateFunc,
  TypeMismatchError,
} from "../index.js";
import { defaultBuiltins } from "./builtins.js";

const allSprig = (): FuncMap => ({
  ...sprigConversions(),
  ...sprigDatetime(),
  ...sprigDefaults(),
  ...sprigDicts(),
  ...sprigFlow(),
  ...sprigHash(),
  ...sprigLists(),
  ...sprigMath(),
  ...sprigRandom(),
  ...sprigRegex(),
  ...sprigSemver(),
  ...sprigStrings(),
  ...sprigTypes(),
});

const engine = createEngine<string>({ fromString: (s) => s, funcs: allSprig() });
const render = (src: string): string => engine.parse(src).evaluate(null).join("");

// ---------------------------------------------------------------------------
// Rejection — what the error carries, and where it points.
// ---------------------------------------------------------------------------

describe("arity gate — rejects the counts Go rejects", () => {
  it("reports the count as structured fields, not only in the message", () => {
    let caught: unknown;
    try {
      render('{{ upper "a" "b" }}');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ArgCountError);
    const err = caught as ArgCountError;
    expect(err.funcName).toBe("upper");
    expect(err.accepted).toEqual({ minimum: 1, maximum: 1 });
    expect(err.got).toBe(2);
    expect(err.kind).toBe("ArgCountError");
  });

  it("carries the call-site position and a source caret", () => {
    let caught: unknown;
    try {
      engine.parse('hello\n{{ upper "a" "b" }}\n').evaluate(null);
    } catch (err) {
      caught = err;
    }
    const err = caught as ArgCountError;
    expect(err.pos.line).toBe(2);
    expect(err.sourceSnippet).toContain("^");
    expect(err.toString()).toContain("at line 2");
  });

  it("rejects a surplus argument to a fixed-arity func instead of ignoring it", () => {
    // The bug this ticket exists for: `upper "a" "b"` rendered "A".
    expect(() => render('{{ upper "a" "b" }}')).toThrow(ArgCountError);
  });

  it("reports too few arguments as a count error, not a misdiagnosed type error", () => {
    // `substr "a"` used to shift the string into the first integer
    // slot and complain about the type — confidently wrong about which
    // mistake the author made.
    expect(() => render('{{ substr "a" }}')).toThrow(/wrong number of args/);
  });
});

// ---------------------------------------------------------------------------
// Acceptance — the gate must not reject what Go accepts.
// ---------------------------------------------------------------------------

describe("arity gate — accepts the counts Go accepts", () => {
  it.each([
    // sprig's `add` is `func(i ...interface{})`: numIn 1, variadic, so
    // its gate wants at least 0. Go renders both of these.
    ["{{ add }}", "0"],
    ["{{ add 1 }}", "1"],
    ["{{ add 1 2 3 }}", "6"],
    // Go's `eq` is `func(reflect.Value, ...reflect.Value)`: the gate
    // wants one argument. The two-argument requirement is eq's *body*,
    // a different error — so the gate must let this through.
    ["{{ eq 1 }}", "false"],
    // `dict` is alternating with minimum 0.
    ['{{ dict "a" 1 | keys | join "," }}', "a"],
    // Zero-arity funcs still work as bare identifiers.
    ["{{ list | len }}", "0"],
    // The pipe-fed value counts as the last argument, not as a surplus.
    ['{{ "a" | upper }}', "A"],
    ['{{ "abc" | trunc 2 }}', "ab"],
  ])("%s → %s", (src, expected) => {
    expect(render(src)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Universal property over every registration the engine ships.
//
// This is where the epic's criterion is actually discharged: *no*
// wrong-count call to *any* registered func reaches a body, and none
// escapes the TemplateError hierarchy as a raw JS TypeError. Eight
// hand-picked examples cannot say that; a sweep can.
//
// The bounds restate the rule the README's arity table publishes,
// written out once here so the gate is checked against the documented
// contract rather than against its own derivation — a gate that drifts
// from the table fails this file.
//
// Scope, deliberately: only counts the gate is supposed to *reject*.
// What a body does with a count Go accepts is a body's business and
// another ticket's — `keys` with zero arguments still throws a raw
// TypeError, a legal-in-Go call recorded as a body gap on
// template-conformance-3ds. Widening this sweep to legal counts would
// dress that up as an arity failure.
// ---------------------------------------------------------------------------

function documentedBounds(fn: TemplateFunc): { minimum: number; maximum: number } {
  switch (fn.arity.kind) {
    case "exact":
      return { minimum: fn.argTypes.length, maximum: fn.argTypes.length };
    case "variadic":
      return { minimum: fn.argTypes.length - 1, maximum: Infinity };
    case "alternating":
      return { minimum: fn.arity.minimum, maximum: Infinity };
  }
}

const callWith = (name: string, count: number): string => `{{ ${name}${' "x"'.repeat(count)} }}`;

/**
 * Every registration a `createEngine` call can reach: the builtins the
 * constructor merges in itself, plus the thirteen sprig categories,
 * flattened in the engine's own merge order. Where `sprigLists` shadows
 * a builtin (`len`, `slice`), the survivor here is the declaration
 * `render` actually reaches — which is the point: this file sweeps the
 * surface a caller can invoke. `go-arity.test.ts` keeps the same maps
 * *separate* for the opposite reason — it audits every declaration site
 * against Go, where a shadowed one must not vanish — and remains what
 * pins these declarations to Go's real signatures.
 */
const everyRegistration: ReadonlyArray<readonly [string, TemplateFunc]> = Object.entries({
  ...defaultBuiltins(String, () => false),
  ...allSprig(),
}).sort(([a], [b]) => a.localeCompare(b));

describe("arity gate — universal property over every registration", () => {
  it("sweeps the whole shipped registry, builtins included", () => {
    const names = everyRegistration.map(([name]) => name);
    // Canaries from both halves: a shrunken sweep that silently
    // generated no cases would still pass a bare length assertion.
    expect(names).toEqual(expect.arrayContaining(["printf", "index", "upper", "dict", "b64enc"]));
    expect(names.length).toBeGreaterThan(150);
  });

  for (const [name, fn] of everyRegistration) {
    const { minimum, maximum } = documentedBounds(fn);

    if (minimum > 0) {
      it(`${name}: every count below the minimum (${minimum}) is an ArgCountError`, () => {
        for (let count = 0; count < minimum; count++) {
          let caught: unknown;
          try {
            render(callWith(name, count));
          } catch (err) {
            caught = err;
          }
          expect(caught, `${name} with ${count} args`).toBeInstanceOf(ArgCountError);
          expect((caught as ArgCountError).got).toBe(count);
        }
      });
    }

    if (maximum < Infinity) {
      it(`${name}: one above the maximum (${maximum}) is an ArgCountError`, () => {
        let caught: unknown;
        try {
          render(callWith(name, maximum + 1));
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(ArgCountError);
        expect((caught as ArgCountError).accepted).toEqual({ minimum, maximum });
      });
    }
  }
});

// ---------------------------------------------------------------------------
// The hierarchy property (template-arity-n2j.7ve): nothing the function
// gate raises escapes `TemplateError`.
//
// The gate has two arms and this file now sweeps both. The count arm is
// swept above — every shipped registration, every count it must reject,
// asserted `instanceof ArgCountError`. This is the type arm: a legal
// *count* of arguments, one of which is a value the declared slot
// refuses, for every slot of every shipped registration that refuses
// anything. A raw JS `TypeError` reaching a consumer from either arm is
// what this epic exists to make impossible, and a sweep is the only
// thing that can say "no registration" rather than "not these eight".
//
// The boundary, recorded so it is not re-litigated: the property is
// about what the *gate* raises. Two neighbours are deliberately outside
// it, and neither is an arity failure wearing a disguise —
//
//  - **Func bodies.** A count and a set of types Go accepts can still
//    fail inside the body: `{{ keys }}` is legal in Go (numIn 1,
//    variadic, so the gate's minimum is 0) and still raw-throws
//    "Cannot convert undefined or null to object". That is a body gap,
//    recorded on template-conformance-3ds, and widening this sweep to
//    legal calls would dress it up as an arity failure. The gate's job
//    is to guarantee the body is entered with a count and shapes the
//    signature admits; what the body then does with them is the body's
//    contract.
//  - **Consumer callbacks the gate invokes.** `fromString` (the
//    "liftable" lift) and `isT` are consumer code running at the gate,
//    the same category as a body: if a consumer's `fromString` throws,
//    the throw is theirs. The existing `"stringifiable"` probe already
//    reads a consumer `toString` throw as *data* ("cannot flatten")
//    rather than as an error, which is the same line drawn from the
//    other side.
//
// Each case asserts the func name and the 1-based slot as well as the
// class, because `evalCommand` re-emits a body-thrown TypeMismatchError
// with call-site position — so the class alone cannot distinguish "the
// gate refused slot i" from "a stale filler slipped past and the body's
// own nested check caught it". Pinning the slot turns a stale witness
// into a red test instead of a silent pass.
// ---------------------------------------------------------------------------

const witnessCall = (name: string, count: number): string =>
  `{{ ${name}${Array.from({ length: count }, (_, i) => ` .a${i}`).join("")} }}`;

const witnessScope = (values: readonly unknown[]): Record<string, unknown> =>
  Object.fromEntries(values.map((v, i) => [`a${i}`, v]));

describe("arity gate — no type rejection escapes the TemplateError hierarchy", () => {
  const cases = everyRegistration.flatMap(([name, fn]) =>
    fn.argTypes.flatMap((declared, slot) =>
      hasRejectWitness(declared) ? [{ name, fn, slot, declared }] : [],
    ),
  );

  it("sweeps a slot of most shipped registrations, builtins included", () => {
    const names = new Set(cases.map((c) => c.name));
    // Canaries from both halves, picked so a sweep that silently
    // generated nothing would fail here rather than pass vacuously.
    expect([...names]).toEqual(
      expect.arrayContaining(["upper", "substr", "index", "len", "b64enc"]),
    );
    expect(cases.length).toBeGreaterThan(150);
  });

  for (const { name, fn, slot, declared } of cases) {
    it(`${name}: a value slot ${slot + 1} refuses (declared ${declared}) is a TemplateError`, () => {
      // One value per declared slot. That count is legal for all three
      // arities — `documentedBounds` is asserted rather than assumed, so
      // a future registration whose minimum outruns its declared slots
      // reddens here instead of quietly turning this case into a count
      // rejection that would pass for the wrong reason.
      const values = fn.argTypes.map((t, i) => (i === slot ? REJECTED[declared] : ACCEPTED[t]));
      expect(
        documentedBounds(fn).minimum,
        `${name} declares fewer slots than its minimum`,
      ).toBeLessThanOrEqual(values.length);

      let caught: unknown;
      try {
        engine.parse(witnessCall(name, values.length)).evaluate(witnessScope(values));
      } catch (err) {
        caught = err;
      }
      expect(caught, `${name} slot ${slot + 1} was not refused`).toBeInstanceOf(TemplateError);
      expect(caught).toBeInstanceOf(TypeMismatchError);
      const err = caught as TypeMismatchError;
      expect(err.funcName).toBe(name);
      expect(err.argIndex).toBe(slot + 1);
    });
  }
});

// ---------------------------------------------------------------------------
// Registration-time well-formedness.
// ---------------------------------------------------------------------------

describe("arity gate — malformed declarations fail at construct time", () => {
  it.each([
    "variadic",
    "alternating",
  ] as const)("rejects a %s func that declares no argTypes", (kind) => {
    const arity = kind === "variadic" ? { kind } : { kind, minimum: 0 };
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        funcs: { broken: { fn: () => "x", argTypes: [], arity } },
      }),
    ).toThrow(/needs at least one declared argType/);
  });

  // A minimum that is negative or non-finite makes `values.length <
  // accepted.minimum` unsatisfiable, so the func ships with no lower
  // bound at all rather than a wrong one — silent, which is why it is
  // rejected here and not floored downstream.
  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1.5,
  ])("rejects an alternating func whose minimum is %p", (minimum) => {
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        funcs: {
          broken: {
            fn: () => "x",
            argTypes: ["value"],
            arity: { kind: "alternating", minimum },
          },
        },
      }),
    ).toThrow(/needs a non-negative integer minimum/);
  });

  it("names the func whose alternating minimum is malformed", () => {
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        funcs: {
          myBadCycle: {
            fn: () => "x",
            argTypes: ["value"],
            arity: { kind: "alternating", minimum: -1 },
          },
        },
      }),
    ).toThrow(/myBadCycle/);
  });

  it("accepts an alternating func whose minimum is zero", () => {
    const eng = createEngine<string>({
      fromString: (s) => s,
      funcs: {
        pairs: {
          fn: (...a: unknown[]) => String(a.length),
          argTypes: ["string", "value"],
          arity: { kind: "alternating", minimum: 0 },
        },
      },
    });
    expect(eng.parse("{{ pairs }}").evaluate(null).join("")).toBe("0");
  });

  it("names the offending func so the message locates the bug", () => {
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        funcs: { myBrokenFunc: { fn: () => "x", argTypes: [], arity: { kind: "variadic" } } },
      }),
    ).toThrow(/myBrokenFunc/);
  });

  it("accepts an exact func that declares no argTypes (a genuine zero-arity func)", () => {
    const eng = createEngine<string>({
      fromString: (s) => s,
      funcs: { pi: { fn: () => "3", argTypes: [], arity: { kind: "exact" } } },
    });
    expect(eng.parse("{{ pi }}").evaluate(null).join("")).toBe("3");
    expect(() => eng.parse('{{ pi "x" }}').evaluate(null)).toThrow(ArgCountError);
  });

  // A declaration that casts past `ArgType` used to construct cleanly
  // and then raw-throw `Error("invalid ArgType: number")` out of the
  // matcher mid-render — outside the TemplateError hierarchy, with no
  // position, no caret and no func name, which is the very shape
  // template-arity-n2j.7ve exists to remove. The kind a slot declares is
  // a fact about the declaration, so it is known here, before any
  // template is parsed.
  it("rejects a slot declaring a kind that is not an ArgType", () => {
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        funcs: {
          stale: {
            fn: () => "x",
            // The retired permissive kind, exactly as a stale
            // registration would still spell it.
            argTypes: ["string", "number" as ArgType],
            arity: { kind: "exact" },
          },
        },
      }),
    ).toThrow(/funcs\.stale: argTypes\[1\] is "number", which is not an ArgType/);
  });

  it("checks consumer overrides too, not only built-ins", () => {
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        // `upper` is a built-in; a malformed override must not slip past.
        funcs: { upper: { fn: () => "x", argTypes: [], arity: { kind: "variadic" } } },
      }),
    ).toThrow(/upper/);
  });
});

// ---------------------------------------------------------------------------
// The alternating lower bound, which no shipped registration exercises.
// `dict` is the only `"alternating"` func and declares `minimum: 0`, a
// value that satisfies `values.length < minimum` whatever the gate read —
// so a nonzero minimum is the only case that proves `acceptedArgCount`
// reads `arity.minimum` rather than assuming a zero floor.
// ---------------------------------------------------------------------------

describe("arity gate — an alternating func with a nonzero minimum", () => {
  const eng = createEngine<string>({
    fromString: (s) => s,
    funcs: {
      pairs: {
        fn: (...args: unknown[]) => String(args.length),
        argTypes: ["string", "value"],
        arity: { kind: "alternating", minimum: 2 },
      },
    },
  });
  const run = (src: string): string => eng.parse(src).evaluate(null).join("");

  it.each([0, 1])("rejects %i arguments, below the declared minimum of 2", (count) => {
    let caught: unknown;
    try {
      run(callWith("pairs", count));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ArgCountError);
    expect((caught as ArgCountError).accepted).toEqual({ minimum: 2, maximum: Infinity });
    expect((caught as ArgCountError).got).toBe(count);
    expect((caught as ArgCountError).message).toContain("want at least 2 got");
  });

  it("accepts the minimum and every count above it", () => {
    expect(run('{{ pairs "a" 1 }}')).toBe("2");
    expect(run('{{ pairs "a" 1 "b" 2 }}')).toBe("4");
  });
});
