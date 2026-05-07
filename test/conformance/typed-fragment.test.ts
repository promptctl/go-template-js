/**
 * Conformance harness — generic-T mode.
 *
 * Iterates the same fixtures as the string-mode harness, but only
 * runs against fixtures that opt in by providing an
 * `expected-fragments.json` file. The test instantiates the engine
 * with `T = TaggedFragment` and asserts the output fragment list
 * matches the expected tree structurally.
 *
 * The harness registers a small set of test-only styling funcs so
 * fixtures don't need a real consumer (rich-js, etc.) to exercise
 * the typed path:
 *
 *   tagAs "name" "value"     → { tag: "name", text: "value" }
 *   tagAs "name" .x          → { tag: "name", text: <stringified .x> }
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEngine, type FuncMap } from "../../src/index.js";

interface TaggedFragment {
  readonly tag: string;
  readonly text: string;
}

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(FIXTURES_DIR, name, "expected-fragments.json")))
    .sort();
}

function readFixture(name: string): {
  template: string;
  scope: unknown;
  expected: TaggedFragment[];
} {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const expected = JSON.parse(
    readFileSync(join(dir, "expected-fragments.json"), "utf8"),
  ) as TaggedFragment[];
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

const fixtures = listFixtures();

describe("conformance — typed-fragment (T = TaggedFragment)", () => {
  if (fixtures.length === 0) {
    it.skip("no typed-fragment fixtures (expected-fragments.json) present", () => {});
    return;
  }

  for (const name of fixtures) {
    it(name, () => {
      const { template, scope, expected } = readFixture(name);
      const engine = createEngine<TaggedFragment>({
        fromString: (s) => ({ tag: "text", text: s }),
        funcs: stylingFuncs,
      });
      const output = engine.parse(template).evaluate(scope);
      expect(output).toEqual(expected);
    });
  }
});
