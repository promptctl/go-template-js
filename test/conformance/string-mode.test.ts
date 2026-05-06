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
  sprigDefaults,
  sprigDicts,
  sprigLists,
  sprigMath,
  sprigRegex,
  sprigStrings,
  sprigTypes,
} from "../../src/index.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .sort();
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
});

const fixtures = listFixtures();

describe("conformance — string-mode (T = string)", () => {
  if (fixtures.length === 0) {
    it.skip("no fixtures present", () => {});
    return;
  }

  // The list of fixtures we knowingly diverge on. Documented in the
  // README and conformance/fixtures/README.md. Each entry should have
  // a comment explaining the divergence so future-us knows to revisit
  // when the underlying gap closes.
  const knownDivergent = new Set<string>([
    // Go's printf is strict about numeric type/verb pairing: `printf %d`
    // on a float64 (which is what JSON int decoding produces in Go) emits
    // `%!d(float64=42)`. Our engine has only one JS `number` type and
    // can't tell whether it came from a float64 or an int — we render
    // `42` plainly. Documented in the README's printf divergence note.
    "builtin-printf-verbs",
  ]);

  for (const name of fixtures) {
    const test = knownDivergent.has(name) ? it.skip : it;
    test(name, () => {
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
