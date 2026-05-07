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

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createEngine,
  type FuncMap,
  sprigDefaults,
  sprigDicts,
  sprigLists,
  sprigMath,
  sprigRegex,
  sprigStrings,
  sprigTypes,
  TypeMismatchError,
} from "../../src/index.js";

interface TaggedFragment {
  readonly tag: string;
  readonly text: string;
}

interface ExpectedError {
  readonly kind: "TypeMismatchError";
  readonly funcName: string;
  readonly argIndex: number;
}

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(FIXTURES_DIR, name, "expected-error.json")))
    .sort();
}

function readFixture(name: string): {
  template: string;
  scope: unknown;
  expected: ExpectedError;
} {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const expected = JSON.parse(
    readFileSync(join(dir, "expected-error.json"), "utf8"),
  ) as ExpectedError;
  let scope: unknown = null;
  const scopePath = join(dir, "scope.json");
  if (existsSync(scopePath)) {
    scope = JSON.parse(readFileSync(scopePath, "utf8"));
  }
  return { template, scope, expected };
}

const stylingFuncs: FuncMap = {
  tagAs: {
    fn: (tag: unknown, value: unknown): TaggedFragment => ({
      tag: String(tag),
      text: String(value),
    }),
    argTypes: ["string", "value"],
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
});

const fixtures = listFixtures();

describe("conformance — error-parity (TypeMismatchError)", () => {
  if (fixtures.length === 0) {
    it.skip("no error-parity fixtures (expected-error.json) present", () => {});
    return;
  }

  for (const name of fixtures) {
    it(name, () => {
      const { template, scope, expected } = readFixture(name);
      const engine = createEngine<TaggedFragment>({
        fromString: (s) => ({ tag: "text", text: s }),
        funcs: { ...allSprig(), ...stylingFuncs },
      });

      let caught: unknown;
      try {
        engine.parse(template).evaluate(scope);
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
