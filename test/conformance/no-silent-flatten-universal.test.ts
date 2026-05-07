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
    case "collection":
      return [];
    case "index-key":
      return 0;
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
        declared === "any" ||
        declared === "T" ||
        declared === "value" ||
        declared === "truthy" ||
        declared === "reflective" ||
        declared === "dict" ||
        declared === "serializable" ||
        declared === "comparable" ||
        declared === "collection" ||
        declared === "sized"
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
