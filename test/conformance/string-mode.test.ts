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
  type Delims,
  sprigConversions,
  sprigDatetime,
  sprigDefaults,
  sprigDicts,
  sprigFlow,
  sprigHash,
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

interface Fixture {
  template: string;
  scope: unknown;
  expected: string;
  delims: Delims | undefined;
}

// [LAW:single-enforcer] Mirrors `conformance/gen/main.go`'s fixtureConfig.
// The same on-disk JSON shape configures both engines, so the conformance
// guarantee is "same inputs → same outputs" with no harness-side
// divergence in how the inputs are interpreted.
interface FixtureConfig {
  delims?: [string, string];
}

function readFixture(name: string): Fixture {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const expected = readFileSync(join(dir, "expected.txt"), "utf8");
  let scope: unknown = null;
  const scopePath = join(dir, "scope.json");
  if (existsSync(scopePath)) {
    scope = JSON.parse(readFileSync(scopePath, "utf8"));
  }
  let delims: Delims | undefined;
  const configPath = join(dir, "config.json");
  if (existsSync(configPath)) {
    const cfg = JSON.parse(readFileSync(configPath, "utf8")) as FixtureConfig;
    if (cfg.delims) {
      delims = { left: cfg.delims[0], right: cfg.delims[1] };
    }
  }
  return { template, scope, expected, delims };
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
  ...sprigHash(),
  ...sprigDatetime(),
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
      const { template, scope, expected, delims } = readFixture(name);
      const engine = createEngine<string>({
        fromString: (s) => s,
        funcs: allSprig(),
        ...(delims ? { delims } : {}),
      });
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
