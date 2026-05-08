/**
 * Conformance harness — TS engine output vs. Go reference output,
 * byte-for-byte, in degenerate `T = string` mode.
 *
 * Iterates every fixture under conformance/fixtures/. Each fixture is
 * its own vitest test for greppability — failures name the fixture
 * directly.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createEngine,
  sprigConversions,
  sprigDefaults,
  sprigDicts,
  sprigFlow,
  sprigLists,
  sprigMath,
  sprigRegex,
  sprigSemver,
  sprigStrings,
  sprigTypes,
} from "../../src/index.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return (
    readdirSync(FIXTURES_DIR)
      .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
      // Only consider fixtures that have a Go-reference output. The
      // typed-fragment harness uses fixtures without expected.txt.
      .filter((name) => existsSync(join(FIXTURES_DIR, name, "expected.txt")))
      .sort()
  );
}

function readFixture(name: string): { template: string; scope: unknown; expected: string } {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const expected = readFileSync(join(dir, "expected.txt"), "utf8");
  let scope: unknown = null;
  const scopePath = join(dir, "scope.json");
  if (existsSync(scopePath)) {
    scope = JSON.parse(readFileSync(scopePath, "utf8"));
  }
  return { template, scope, expected };
}

const allSprig = () => ({
  ...sprigDefaults(),
  ...sprigStrings(),
  ...sprigMath(),
  ...sprigLists(),
  ...sprigDicts(),
  ...sprigRegex(),
  ...sprigTypes(),
  ...sprigConversions(),
  ...sprigSemver(),
  ...sprigFlow(),
});

const fixtures = listFixtures();

describe("conformance — string-mode (T = string)", () => {
  if (fixtures.length === 0) {
    it.skip("no fixtures present", () => {});
    return;
  }

  // [LAW:behavior-not-structure] No skip-list, no divergence file. A
  // fixture either parities (expected.txt byte-equality) or asserts a
  // parity error (expected-error.json under the error-parity harness).
  // Anything in between is a fixture authoring problem, not a test
  // configuration problem.
  for (const name of fixtures) {
    it(name, () => {
      const { template, scope, expected } = readFixture(name);
      const engine = createEngine<string>({ fromString: (s) => s, funcs: allSprig() });
      const output = engine.parse(template).evaluate(scope).join("");
      if (output !== expected) {
        // Show first divergence offset to aid debugging.
        let offset = 0;
        while (offset < output.length && offset < expected.length) {
          if (output[offset] !== expected[offset]) break;
          offset += 1;
        }
        console.error(
          `Fixture ${name} diverged at byte ${offset}:\n` +
            `  expected: ${JSON.stringify(expected)}\n` +
            `  actual:   ${JSON.stringify(output)}`,
        );
      }
      expect(output).toBe(expected);
    });
  }
});
