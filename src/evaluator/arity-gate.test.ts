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
 * The expected message text in `GO_VERIFIED` was produced by running
 * the same templates through Go 1.25.7's `text/template`, not written
 * from memory. Pinning it against Go as *fixtures* is
 * template-arity-n2j.jln; these are the eight cases that fit in a unit
 * test.
 */

import { describe, expect, it } from "vitest";
import {
  ArgCountError,
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
  type TemplateFunc,
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
// Rejection — the message is Go's, verbatim.
// ---------------------------------------------------------------------------

const GO_VERIFIED: ReadonlyArray<readonly [string, string]> = [
  ['{{ upper "a" "b" }}', "wrong number of args for upper: want 1 got 2"],
  ["{{ upper }}", "wrong number of args for upper: want 1 got 0"],
  ['{{ trim " a " " b " }}', "wrong number of args for trim: want 1 got 2"],
  ['{{ substr "a" }}', "wrong number of args for substr: want 3 got 1"],
  ['{{ trunc "abc" }}', "wrong number of args for trunc: want 2 got 1"],
  ["{{ min }}", "wrong number of args for min: want at least 1 got 0"],
  ["{{ printf }}", "wrong number of args for printf: want at least 1 got 0"],
  ["{{ index }}", "wrong number of args for index: want at least 1 got 0"],
];

describe("arity gate — rejects the counts Go rejects", () => {
  for (const [src, message] of GO_VERIFIED) {
    it(`${src} → ${message}`, () => {
      expect(() => render(src)).toThrow(ArgCountError);
      expect(() => render(src)).toThrow(message);
    });
  }

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
