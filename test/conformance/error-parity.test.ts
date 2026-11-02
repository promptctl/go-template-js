/**
 * Conformance harness — error-parity mode.
 *
 * Iterates fixtures that opt in via an `expected-error.json` file and
 * asserts the engine throws `TypeMismatchError` with matching
 * `kind`, `funcName`, and `argIndex`.
 *
 * [LAW:verifiable-goals] These fixtures are the deterministic test for
 * the no-silent-flatten architectural commitment. A fixture either has
 * `expected.txt` (byte-equality), `expected-fragments.json` (structural
 * equality), or `expected-error.json` (error parity) — there is no
 * skip-list and no divergence file.
 *
 * Engine setup: T = TaggedFragment with `tagAs` registered alongside
 * the full sprig + builtin surface, mirroring the typed-fragment
 * harness so any fixture that produces a typed fragment can flow into
 * a string-typed sprig func and trip the guard.
 */

import { describe, expect, it } from "vitest";
import {
  createEngine,
  type FuncMap,
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
import { listFixtures, readFixtureInput, readOutcome, renderFixture } from "./fixtures.js";

interface TaggedFragment {
  readonly tag: string;
  readonly text: string;
}

interface ExpectedError {
  readonly kind: "TypeMismatchError";
  readonly funcName: string;
  readonly argIndex: number;
}

const stylingFuncs: FuncMap = {
  tagAs: {
    fn: (tag: unknown, value: unknown): TaggedFragment => ({
      tag: String(tag),
      text: String(value),
    }),
    argTypes: ["string", "value"],
    arity: { kind: "exact" },
    returnType: "T",
  },
};

const allSprig = (): FuncMap => ({
  ...sprigDefaults(),
  ...sprigStrings(),
  ...sprigMath(),
  ...sprigLists(),
  ...sprigDicts(),
  ...sprigRegex(),
  ...sprigTypes(),
  ...sprigConversions(),
});

const fixtures = listFixtures("expected-error.json");

describe("conformance — error-parity (TypeMismatchError)", () => {
  if (fixtures.length === 0) {
    it.skip("no error-parity fixtures (expected-error.json) present", () => {});
    return;
  }

  for (const name of fixtures) {
    it(name, () => {
      const expected = JSON.parse(readOutcome(name, "expected-error.json")) as ExpectedError;

      let caught: unknown;
      try {
        renderFixture(
          (delims) =>
            createEngine<TaggedFragment>({
              fromString: (s) => ({ tag: "text", text: s }),
              funcs: { ...allSprig(), ...stylingFuncs },
              ...(delims ? { delims } : {}),
            }),
          readFixtureInput(name),
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeMismatchError);
      const err = caught as TypeMismatchError;
      expect(err.kind).toBe(expected.kind);
      expect(err.funcName).toBe(expected.funcName);
      expect(err.argIndex).toBe(expected.argIndex);
    });
  }
});
