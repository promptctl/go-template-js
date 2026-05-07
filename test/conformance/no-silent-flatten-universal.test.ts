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
 * category). For each non-"any", non-"T" `argTypes` slot, it places a
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

const allRegisteredFuncs = (): FuncMap => ({
  ...defaultBuiltins(),
  ...sprigDefaults(),
  ...sprigStrings(),
  ...sprigMath(),
  ...sprigLists(),
  ...sprigDicts(),
  ...sprigRegex(),
  ...sprigTypes(),
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
      return 0;
    case "bool":
      return false;
    case "ordered":
      return 0;
    case "T":
      return TAGGED;
    case "any":
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
      //  - "any":        explicit permissive escape (removed in .9)
      //  - "T":          accepts typed fragments by definition
      //  - "value":      genuinely heterogeneous (constructors / structural ops)
      //  - "truthy":     truthiness context — anything is meaningful
      //  - "reflective": type-inspection context — anything is meaningful
      // ("serializable" is runtime-validated; a TaggedFragment is JSON-
      // encodable so it would pass — that slot needs a different probe
      // value, addressed by whichever ticket first registers one.)
      if (
        declared === "any" ||
        declared === "T" ||
        declared === "value" ||
        declared === "truthy" ||
        declared === "reflective"
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

  for (const { funcName, slot, declared } of cases) {
    it(`${funcName} rejects TaggedFragment in slot ${slot + 1} (declared ${declared})`, () => {
      const fn = funcs[funcName];
      if (!fn) throw new Error(`func ${funcName} disappeared from registry`);
      const values = fn.argTypes.map((t, i) => (i === slot ? TAGGED : fillerFor(t)));
      let caught: unknown;
      try {
        enforceArgTypes(funcName, fn.argTypes, values, POS, undefined);
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
