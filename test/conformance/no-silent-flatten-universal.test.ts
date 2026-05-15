/**
 * Universal no-silent-flatten property.
 *
 * [LAW:single-enforcer] `enforceArgTypes` is the one place where
 * registered-func arguments are validated against declared `argTypes`.
 * The architectural commitment ("a typed-T fragment never silently
 * flows into a non-permissive slot") is therefore a universal property
 * over every registered func — not a per-fixture sample.
 *
 * [LAW:verifiable-goals] This harness asserts that property mechanically
 * for every entry in the merged FuncMap (default builtins + every sprig
 * category). For each non-"T", non-permissive `argTypes` slot, it places a
 * TaggedFragment in that slot and confirms the gate throws
 * `TypeMismatchError` naming the func and (1-based) slot index.
 *
 * Imports `enforceArgTypes` from a deep path — that's intentional, it
 * is not part of the public stability surface.
 */
import { describe, expect, it } from "vitest";
import { defaultBuiltins } from "../../src/evaluator/builtins.js";
import { type ArgType, enforceArgTypes, type FuncMap } from "../../src/evaluator/evaluator.js";
import {
  sprigConversions,
  sprigDefaults,
  sprigDicts,
  sprigLists,
  sprigMath,
  sprigRegex,
  sprigStrings,
  sprigTypes,
  TypeMismatchError,
} from "../../src/index.js";
import { pos } from "../../src/parser/pos.js";

interface TaggedFragment {
  readonly tag: string;
  readonly text: string;
}

const TAGGED: TaggedFragment = { tag: "color", text: "x" };

// Bodies are never executed by this harness — it inspects argTypes /
// argTypePattern only, then drives `enforceArgTypes` directly. The
// `toString` passed here is therefore a stub; the matcher uses the
// `enforceArgTypes` parameter, which defaults to the engine's real
// `defaultToString`.
const HARNESS_TOSTRING = (v: unknown): string => {
  throw new Error(`harness toString not exercised (got ${typeof v})`);
};

const allRegisteredFuncs = (): FuncMap => ({
  ...defaultBuiltins(HARNESS_TOSTRING),
  ...sprigDefaults(),
  ...sprigStrings(),
  ...sprigMath(),
  ...sprigLists(),
  ...sprigDicts(),
  ...sprigRegex(),
  ...sprigTypes(),
  ...sprigConversions(),
});

// Sane filler value for a slot that's NOT under test. Picks a value
// that satisfies the slot's declared type so the per-slot gate passes
// for all slots except the one carrying the TaggedFragment.
//
// New ArgType kinds (template-laws-3gt.1) get fillers here so the
// exhaustive switch typechecks; no registration uses them yet, so the
// fillers will not actually be exercised until .2–.8 land.
function fillerFor(slot: ArgType): unknown {
  switch (slot) {
    case "string":
      return "x";
    case "number":
    case "int":
    case "float":
      return 0;
    case "bool":
      return false;
    case "ordered":
      return 0;
    case "T":
      return TAGGED;
    case "truthy":
    case "reflective":
    case "value":
      return "x";
    case "list":
      return [];
    case "dict":
      return {};
    case "sized":
      return "";
    case "comparable":
      return 0;
    case "stringifiable":
      return "x";
    case "callable":
      return () => undefined;
    case "collection":
      return [];
    case "index-key":
      return 0;
    case "sliceable":
      return "";
    case "serializable":
      return 0;
  }
}

const POS = pos(1, 1, 0);

describe("conformance — no-silent-flatten universal property", () => {
  const funcs = allRegisteredFuncs();
  const cases: Array<{ funcName: string; slot: number; declared: ArgType }> = [];
  for (const [funcName, fn] of Object.entries(funcs)) {
    fn.argTypes.forEach((declared, slot) => {
      // Permissive-by-intent slots accept TaggedFragments by design and
      // are out of scope for the no-silent-flatten property:
      //  - "T":          accepts typed fragments by definition
      //  - "value":      genuinely heterogeneous (constructors / structural ops)
      //  - "truthy":     truthiness context — anything is meaningful
      //  - "reflective": type-inspection context — anything is meaningful
      //
      // Structurally-permissive slots: a TaggedFragment is structurally
      // a plain `{ tag, text }` object, so the matcher cannot
      // distinguish it from a "real" dict without a runtime brand. The
      // no-silent-flatten property doesn't apply here: a typed fragment
      // landing in a dict slot is *used* as a dict (Object.keys etc.),
      // never flattened into a string, so there is no information loss
      // for the property to detect.
      //  - "dict":         TaggedFragment is structurally a plain object
      //  - "serializable": TaggedFragment is JSON-encodable
      //  - "comparable":   TaggedFragment is a plain object → eq/ne
      //                    compare it structurally via deepEqual; no
      //                    string flattening occurs.
      //  - "collection":   TaggedFragment is structurally a plain
      //                    object → `index`'s receiver-shape gate
      //                    accepts it; the body's per-key access
      //                    routes through `Record<string, unknown>[k]`
      //                    without flattening.
      //  - "sized":        TaggedFragment is a plain object → has a
      //                    meaningful `Object.keys` length, so the
      //                    "sized" matcher accepts it. The body returns
      //                    the property count (audit G2's behavior is
      //                    preserved by design — a non-plain-object T
      //                    such as a class instance still throws). The
      //                    no-silent-flatten property doesn't apply
      //                    because no string flattening occurs.
      if (
        declared === "T" ||
        declared === "value" ||
        declared === "truthy" ||
        declared === "reflective" ||
        declared === "dict" ||
        declared === "serializable" ||
        declared === "comparable" ||
        declared === "collection" ||
        declared === "sized" ||
        // "liftable" is the string→T bridge: a typed fragment is
        // exactly what the slot is designed to carry, and a bare
        // string is lifted via the engine's `fromString` before the
        // body sees it. There is no string-flatten direction to
        // protect against here — the slot's whole job is to pass
        // T through and lift strings up.
        declared === "liftable"
      ) {
        return;
      }
      cases.push({ funcName, slot, declared });
    });
  }

  // Sanity floor — if this number drops we've lost coverage.
  it("exercises a non-trivial number of registered slots", () => {
    expect(cases.length).toBeGreaterThan(50);
  });

  // [LAW:one-source-of-truth] After template-laws-3gt.9, "any" is gone
  // from the ArgType union — the type system rejects a registration
  // that declares it. This belt-and-suspenders test catches a future
  // regression where someone reintroduces the literal via a cast or
  // adds it back to the union.
  it('no registered func declares the legacy "any" ArgType', () => {
    for (const [funcName, fn] of Object.entries(funcs)) {
      for (const declared of fn.argTypes) {
        expect(declared, `${funcName} slot declared "any"`).not.toBe("any");
      }
    }
  });

  for (const { funcName, slot, declared } of cases) {
    it(`${funcName} rejects TaggedFragment in slot ${slot + 1} (declared ${declared})`, () => {
      const fn = funcs[funcName];
      if (!fn) throw new Error(`func ${funcName} disappeared from registry`);
      const values = fn.argTypes.map((t, i) => (i === slot ? TAGGED : fillerFor(t)));
      let caught: unknown;
      try {
        enforceArgTypes(
          funcName,
          fn.argTypes,
          values,
          POS,
          undefined,
          undefined,
          fn.argTypePattern,
        );
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(TypeMismatchError);
      const err = caught as TypeMismatchError;
      expect(err.funcName).toBe(funcName);
      expect(err.argIndex).toBe(slot + 1);
    });
  }
});

// [LAW:verifiable-goals] Per-kind positive/negative fixtures. Every
// ArgType kind gets at least one value that should pass the gate and
// at least one that should be rejected. A single-slot synthetic
// signature is the smallest probe that exercises `matchesArgType`
// without dragging in cross-slot rules (which have their own tests).
//
// `"stringifiable"` is the one kind whose match depends on the
// engine's `toString`, so it appears twice: once under the default
// (throws on non-string) and once with a consumer-supplied flattener.
//
// `"comparable"` applies a cross-slot same-kind rule inside
// `enforceArgTypes`; the per-slot probe here only validates the
// membership predicate — the cross-slot case is asserted separately.
type Fixture = { label: string; value: unknown; pass: boolean };

const FN = () => undefined;
const SYM = Symbol("s");
const fixturesByKind: Record<Exclude<ArgType, "stringifiable">, Fixture[]> = {
  string: [
    { label: "string", value: "x", pass: true },
    { label: "empty string", value: "", pass: true },
    { label: "number", value: 1, pass: false },
    { label: "null", value: null, pass: false },
    { label: "object", value: {}, pass: false },
    { label: "array", value: [], pass: false },
  ],
  number: [
    { label: "number", value: 0, pass: true },
    { label: "negative", value: -1.5, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "string", value: "1", pass: false },
    { label: "bool", value: true, pass: false },
    { label: "null", value: null, pass: false },
  ],
  // "int" matcher: finite number OR safe-integer-range bigint. NaN,
  // ±Infinity, and bigints outside Number.MAX_SAFE_INTEGER are
  // rejected — the body's "I receive an integer" assumption is the
  // theorem the matcher proves.
  int: [
    { label: "number", value: 0, pass: true },
    { label: "negative", value: -1.5, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "MAX_SAFE_INTEGER bigint", value: BigInt(Number.MAX_SAFE_INTEGER), pass: true },
    { label: "NaN", value: NaN, pass: false },
    { label: "Infinity", value: Infinity, pass: false },
    { label: "-Infinity", value: -Infinity, pass: false },
    { label: "unsafe-integer bigint", value: 2n ** 100n, pass: false },
    { label: "string", value: "1", pass: false },
    { label: "bool", value: true, pass: false },
    { label: "null", value: null, pass: false },
  ],
  // "float" matcher: any number (NaN/Infinity legitimate IEEE 754) OR
  // bigint whose Number() conversion is finite (rejects overflow-to-
  // Infinity only). Precision-lossy bigints in the finite range are
  // accepted — float doesn't promise exact preservation.
  float: [
    { label: "number", value: 0, pass: true },
    { label: "negative", value: -1.5, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "NaN", value: NaN, pass: true },
    { label: "Infinity", value: Infinity, pass: true },
    { label: "-Infinity", value: -Infinity, pass: true },
    { label: "lossy-but-finite bigint", value: 2n ** 100n, pass: true },
    { label: "overflow-to-Infinity bigint", value: 2n ** 1024n, pass: false },
    { label: "string", value: "1", pass: false },
    { label: "bool", value: true, pass: false },
    { label: "null", value: null, pass: false },
  ],
  bool: [
    { label: "true", value: true, pass: true },
    { label: "false", value: false, pass: true },
    { label: "1", value: 1, pass: false },
    { label: '"true"', value: "true", pass: false },
    { label: "null", value: null, pass: false },
  ],
  T: [
    { label: "object", value: {}, pass: true },
    { label: "array", value: [], pass: true },
    { label: "TaggedFragment", value: TAGGED, pass: true },
    { label: "Map", value: new Map(), pass: true },
    { label: "string", value: "x", pass: false },
    { label: "number", value: 1, pass: false },
    { label: "bool", value: true, pass: false },
    { label: "bigint", value: 1n, pass: false },
    { label: "symbol", value: SYM, pass: false },
    { label: "null", value: null, pass: false },
  ],
  ordered: [
    { label: "string", value: "x", pass: true },
    { label: "number", value: 1, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "bool", value: true, pass: true },
    { label: "null", value: null, pass: false },
    { label: "object", value: {}, pass: false },
    { label: "array", value: [], pass: false },
  ],
  list: [
    { label: "empty array", value: [], pass: true },
    { label: "array", value: [1, 2], pass: true },
    { label: "string", value: "x", pass: false },
    { label: "object", value: {}, pass: false },
    { label: "Map", value: new Map(), pass: false },
    { label: "Set", value: new Set(), pass: false },
    { label: "null", value: null, pass: false },
  ],
  dict: [
    { label: "empty object", value: {}, pass: true },
    { label: "plain object", value: { a: 1 }, pass: true },
    { label: "array", value: [], pass: false },
    { label: "Map", value: new Map(), pass: false },
    { label: "Set", value: new Set(), pass: false },
    { label: "string", value: "x", pass: false },
    { label: "null", value: null, pass: false },
  ],
  sized: [
    { label: "string", value: "x", pass: true },
    { label: "array", value: [1], pass: true },
    { label: "Map", value: new Map(), pass: true },
    { label: "Set", value: new Set(), pass: true },
    { label: "object", value: { a: 1 }, pass: true },
    { label: "number", value: 0, pass: false },
    { label: "bool", value: true, pass: false },
    { label: "null", value: null, pass: false },
    { label: "function", value: FN, pass: false },
  ],
  comparable: [
    { label: "null", value: null, pass: true },
    { label: "undefined", value: undefined, pass: true },
    { label: "string", value: "x", pass: true },
    { label: "number", value: 1, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "bool", value: true, pass: true },
    { label: "array", value: [1, 2], pass: true },
    { label: "Map", value: new Map(), pass: true },
    { label: "Set", value: new Set(), pass: true },
    { label: "object", value: { a: 1 }, pass: true },
    { label: "function", value: FN, pass: false },
    { label: "symbol", value: SYM, pass: false },
  ],
  callable: [
    { label: "arrow", value: FN, pass: true },
    { label: "function", value: () => undefined, pass: true },
    { label: "string", value: "x", pass: false },
    { label: "number", value: 1, pass: false },
    { label: "object", value: {}, pass: false },
    { label: "null", value: null, pass: false },
  ],
  collection: [
    { label: "string", value: "x", pass: true },
    { label: "array", value: [], pass: true },
    { label: "Map", value: new Map(), pass: true },
    { label: "object", value: {}, pass: true },
    { label: "Set", value: new Set(), pass: false },
    { label: "number", value: 1, pass: false },
    { label: "function", value: FN, pass: false },
    { label: "null", value: null, pass: false },
  ],
  "index-key": [
    { label: "string", value: "k", pass: true },
    { label: "number", value: 0, pass: true },
    { label: "bigint", value: 1n, pass: true },
    { label: "bool", value: true, pass: false },
    { label: "null", value: null, pass: false },
    { label: "object", value: {}, pass: false },
    { label: "array", value: [], pass: false },
  ],
  sliceable: [
    { label: "string", value: "abc", pass: true },
    { label: "array", value: [1, 2], pass: true },
    { label: "Map", value: new Map(), pass: false },
    { label: "object", value: {}, pass: false },
    { label: "number", value: 1, pass: false },
    { label: "null", value: null, pass: false },
  ],
  truthy: [
    { label: "string", value: "x", pass: true },
    { label: "number", value: 0, pass: true },
    { label: "bool", value: false, pass: true },
    { label: "null", value: null, pass: true },
    { label: "object", value: {}, pass: true },
    { label: "TaggedFragment", value: TAGGED, pass: true },
  ],
  reflective: [
    { label: "string", value: "x", pass: true },
    { label: "null", value: null, pass: true },
    { label: "TaggedFragment", value: TAGGED, pass: true },
    { label: "function", value: FN, pass: true },
  ],
  value: [
    { label: "string", value: "x", pass: true },
    { label: "number", value: 1, pass: true },
    { label: "TaggedFragment", value: TAGGED, pass: true },
    { label: "null", value: null, pass: true },
    { label: "function", value: FN, pass: true },
  ],
  serializable: [
    { label: "number", value: 0, pass: true },
    { label: "string", value: "x", pass: true },
    { label: "bool", value: true, pass: true },
    { label: "null", value: null, pass: true },
    { label: "array", value: [1, "x"], pass: true },
    { label: "object", value: { a: 1 }, pass: true },
    { label: "function", value: FN, pass: false },
    { label: "bigint", value: 1n, pass: false },
    { label: "symbol", value: SYM, pass: false },
  ],
  liftable: [
    { label: "string", value: "x", pass: true },
    { label: "empty string", value: "", pass: true },
    { label: "object", value: {}, pass: true },
    { label: "array", value: [], pass: true },
    { label: "TaggedFragment", value: TAGGED, pass: true },
    { label: "Map", value: new Map(), pass: true },
    { label: "number", value: 1, pass: false },
    { label: "bool", value: true, pass: false },
    { label: "bigint", value: 1n, pass: false },
    { label: "symbol", value: SYM, pass: false },
    { label: "null", value: null, pass: false },
    { label: "undefined", value: undefined, pass: false },
  ],
};

function probe(declared: ArgType, value: unknown, toString?: (v: unknown) => string): boolean {
  try {
    enforceArgTypes("__probe__", [declared], [value], POS, undefined, toString, undefined);
    return true;
  } catch (err) {
    if (err instanceof TypeMismatchError) return false;
    throw err;
  }
}

describe("conformance — per-kind positive/negative fixtures", () => {
  for (const [kind, fixtures] of Object.entries(fixturesByKind) as Array<
    [Exclude<ArgType, "stringifiable">, Fixture[]]
  >) {
    for (const { label, value, pass } of fixtures) {
      const verb = pass ? "accepts" : "rejects";
      it(`${kind} ${verb} ${label}`, () => {
        expect(probe(kind, value)).toBe(pass);
      });
    }
  }

  // "stringifiable" — default toString throws on non-string.
  describe("stringifiable (default toString)", () => {
    // Default `toString` flattens primitives (number/bigint/bool/null
    // → String(v) or "<nil>") and throws for objects/functions/symbols.
    // The "no silent flatten" property protects typed-T objects, not
    // primitives — primitives have an unambiguous textual form.
    const cases: Fixture[] = [
      { label: "string", value: "x", pass: true },
      { label: "empty string", value: "", pass: true },
      { label: "number", value: 1, pass: true },
      { label: "bool", value: true, pass: true },
      { label: "null", value: null, pass: true },
      { label: "TaggedFragment", value: TAGGED, pass: false },
      { label: "function", value: FN, pass: false },
      { label: "symbol", value: SYM, pass: false },
    ];
    for (const { label, value, pass } of cases) {
      it(`${pass ? "accepts" : "rejects"} ${label}`, () => {
        expect(probe("stringifiable", value)).toBe(pass);
      });
    }
  });

  // "stringifiable" — consumer toString that flattens any object.
  describe("stringifiable (consumer toString flattens objects)", () => {
    const flatten = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "text" in (v as Record<string, unknown>))
        return String((v as { text: unknown }).text);
      throw new TypeError("cannot flatten");
    };
    const cases: Fixture[] = [
      { label: "string", value: "x", pass: true },
      { label: "TaggedFragment", value: TAGGED, pass: true },
      { label: "number", value: 1, pass: false },
      { label: "null", value: null, pass: false },
    ];
    for (const { label, value, pass } of cases) {
      it(`${pass ? "accepts" : "rejects"} ${label}`, () => {
        expect(probe("stringifiable", value, flatten)).toBe(pass);
      });
    }
  });

  // Cross-slot same-kind rule for "comparable" — per-slot match alone
  // is not sufficient; mismatched kinds across two "comparable" slots
  // are rejected by `enforceArgTypes`.
  it("comparable rejects cross-slot kind mismatch (number vs string)", () => {
    let caught: unknown;
    try {
      enforceArgTypes(
        "__probe__",
        ["comparable", "comparable"],
        [1, "x"],
        POS,
        undefined,
        undefined,
        undefined,
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TypeMismatchError);
  });
});
